import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { generateBizNo } from '@/lib/orderNo'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { checkCoupon } from '@/lib/coupon'
import { ensureContractForOrder } from '@/lib/contract-service'
import { trackConversion } from '@/lib/tencent-ads'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  packageId: z.number().int().positive('套餐参数错误'),
  skuId: z.number().int().positive().optional(),
  name: z.string().trim().min(1, '请填写联系人姓名').max(20),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请填写正确的手机号'),
  company: z.string().trim().max(50).optional().default(''),
  city: z.string().trim().max(20).optional().default(''),
  industry: z.string().trim().max(20).optional().default(''),
  remark: z.string().trim().max(500).optional().default(''),
  couponCode: z.string().trim().max(40).optional().default(''),
  // 广告归因：小程序启动参数带下来的 clickid
  clickid: z.string().trim().max(100).optional().default(''),
  adSource: z.string().trim().max(40).optional().default(''),
})


/**
 * 小程序下单（POST）
 * 安全约束：前端只允许传 packageId + 联系信息，
 * 金额一律由服务端按套餐价格计算（整数分），禁止信任前端金额。
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = clientIp(req)
    if (rateLimited(`miniapp-order:${ip}`, 5, 60_000)) {
      return fail('下单过于频繁，请稍后再试', 429, 429)
    }

    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)
    const member = await prisma.member.findFirst({ where: { id: payload.id, status: 'ACTIVE' } })
    if (!member) return fail('登录状态已失效，请重新登录', 401, 401)

    // 用户级限流：同一会员 1 分钟最多 3 单
    if (rateLimited(`miniapp-order-member:${member.id}`, 3, 60_000)) {
      return fail('操作过于频繁，请稍后再试', 429, 429)
    }

    const body = await parseBody(req, createSchema)
    const pkg = await prisma.package.findUnique({ where: { id: body.packageId } })
    if (!pkg || pkg.status !== 1) return fail('所选套餐不存在或已下架', 400)

    // 选中 SKU（可选）：金额/天数/名称一律服务端从 SKU 取，前端金额无效
    let sku: { id: number; name: string; price: number; serviceDays: number; features: string | null } | null = null
    if (body.skuId) {
      const found = await prisma.packageSku.findFirst({
        where: { id: body.skuId, packageId: pkg.id, status: 1 },
      })
      if (!found) return fail('所选规格不存在或已下架', 400)
      sku = { id: found.id, name: found.name, price: found.price, serviceDays: found.serviceDays, features: found.features }
    }
    const unitPrice = sku ? sku.price : pkg.price
    const unitServiceDays = sku ? sku.serviceDays : (pkg.periodDays || 31)

    // 优惠码：服务端校验 + 计算抵扣（金额一律服务端取价，前端金额无效）
    let discount = 0
    let couponId: number | null = null
    const couponCode = (body.couponCode || '').trim()
    if (couponCode) {
      const r = await checkCoupon(couponCode, unitPrice, member.id)
      if (!r.ok) return fail(r.message || '优惠码不可用', 400)
      discount = r.discount || 0
      couponId = r.couponId ?? null
    }
    const finalAmount = unitPrice - discount

    // 广告归因：无 clickid 时为 null（普通流量不进广告归因）
    const clickid = (body.clickid || '').trim() || null
    const adSource = clickid ? (body.adSource || 'tencent').trim() : null

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNo: await generateBizNo('order', member.userId),
          packageId: pkg.id,
          skuId: sku?.id ?? null,
          skuName: sku?.name ?? null,
          packageName: pkg.name,
          period: sku ? sku.name : pkg.period,
          // 套餐快照：后续套餐改服务项/天数不影响本订单
          packageServicesJson: sku?.features || pkg.servicesJson || pkg.features || null,
          periodDays: unitServiceDays,
          amount: finalAmount,
          discountAmount: discount,
          couponCode: couponCode || null,
          couponId,
          currency: 'CNY',
          status: 'PENDING',
          memberId: member.id,
          name: body.name,
          phone: body.phone,
          company: body.company || null,
          city: body.city || null,
          industry: body.industry || null,
          remark: body.remark || null,
          source: 'MINIAPP',
          clickid,
          adSource,
        },
      })
      if (couponId) {
        await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } })
      }
      return created
    })

    // 回传腾讯广告：下单转化（内部吞异常，不影响下单结果）
    void trackConversion({ clickid, event: 'ORDER', traceId: order.orderNo })

    // 下单即自动生成合同（待签状态），未签合同不允许支付
    let contractId: number | null = null
    let contractNo: string | null = null
    try {
      const contract = await ensureContractForOrder(order.id)
      contractId = contract?.id ?? null
      contractNo = contract?.contractNo ?? null
    } catch (e) {
      // 合同生成失败不阻断下单：支付前仍会再做一次兜底生成 + 强校验
      console.error('[order] ensure contract failed', e instanceof Error ? e.stack : String(e))
    }

    return ok({
      orderNo: order.orderNo,
      amount: order.amount,
      discountAmount: order.discountAmount,
      packageName: order.packageName,
      status: order.status,
      contractId,
      contractNo,
      needSign: contractId ? true : false,
    })
  })
}

/**
 * 我的订单列表（GET）?status=PENDING|PAID|COMPLETED|REFUNDED|ALL
 * Bearer 鉴权，只返回当前会员自己的订单。
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase()
    const where: { memberId: number; deletedAt: null; status?: 'PENDING' | 'PAID' | 'COMPLETED' | 'REFUNDED' } = {
      memberId: payload.id,
      deletedAt: null,
    }
    if (['PENDING', 'PAID', 'COMPLETED', 'REFUNDED'].includes(status)) {
      where.status = status as typeof where.status
    }

    const list = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        orderNo: true,
        packageName: true,
        skuName: true,
        period: true,
        amount: true,
        currency: true,
        status: true,
        payMethod: true,
        createdAt: true,
        paidAt: true,
        package: { select: { id: true, name: true } },
      },
    })
    return ok({ list })
  })
}
