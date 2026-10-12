import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { orderCreateSchema } from '@/lib/validators'
import { getMemberFromRequest } from '@/lib/member-auth'
import { generateBizNo } from '@/lib/orderNo'
import { checkCoupon } from '@/lib/coupon'

// 简易内存限流：同一 IP 60 秒内最多 5 次下单
const rateMap = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string) {
  const now = Date.now()
  const item = rateMap.get(ip)
  if (!item || item.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  item.count += 1
  return item.count > 5
}

function clientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}


/** 前台下单：需登录（官网 Cookie / 小程序 Bearer），创建待支付订单 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = clientIp(req)
    if (rateLimited(ip)) return fail('下单过于频繁，请稍后再试', 429, 429)

    // 只有登录会员才能购买套餐
    const memberPayload = await getMemberFromRequest(req)
    if (!memberPayload) return fail('请先登录后再购买套餐', 401, 401)
    const member = await prisma.member.findFirst({
      where: { id: memberPayload.id, status: 'ACTIVE' },
    })
    if (!member) return fail('登录状态已失效，请重新登录', 401, 401)

    const body = await parseBody(req, orderCreateSchema)

    const pkg = await prisma.package.findUnique({ where: { id: body.packageId } })
    if (!pkg || pkg.status !== 1) return fail('所选套餐不存在或已下架', 400)

    // 优惠码：服务端校验 + 计算抵扣
    let discount = 0
    let couponId: number | null = null
    const couponCode = (body.couponCode || '').trim()
    if (couponCode) {
      const r = await checkCoupon(couponCode, pkg.price, member.id)
      if (!r.ok) return fail(r.message || '优惠码不可用', 400)
      discount = r.discount || 0
      couponId = r.couponId ?? null
    }
    const finalAmount = pkg.price - discount

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNo: await generateBizNo('order', member.userId),
          packageId: pkg.id,
          packageName: pkg.name,
          period: pkg.period,
          amount: finalAmount,
          discountAmount: discount,
          couponCode: couponCode || null,
          couponId,
          status: 'PENDING',
          memberId: member.id,
          name: body.name || member.name || member.nickname || '会员',
          phone: body.phone || member.phone || '',
          company: body.company || null,
          city: body.city || null,
          industry: body.industry || null,
          remark: body.remark || null,
          source: body.source || '官网套餐页',
        },
      })
      if (couponId) {
        await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } })
      }
      return created
    })

    return ok({ orderNo: order.orderNo, amount: order.amount, discountAmount: order.discountAmount, packageName: order.packageName })
  })
}
