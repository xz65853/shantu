import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { confirmPaid, getProvider, logPayment } from '@/lib/payment/PaymentService'
import { clientIp, rateLimited } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ orderNo: string }> }

/**
 * 小程序订单详情（GET）
 * - Bearer 鉴权 + 归属校验：只能查看自己的订单（防 IDOR）
 * - ?refresh=1：订单仍 PENDING 时，主动向支付渠道查单并幂等确认
 *   （wx.requestPayment 前端返回不代表支付成功，最终以渠道查询/回调为准）
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { orderNo } = await ctx.params
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { package: { select: { id: true, name: true, period: true, summary: true } } },
    })
    if (!order || order.memberId !== payload.id) return fail('订单不存在', 404)

    // 主动查单确认（限流防刷）
    const refresh = new URL(req.url).searchParams.get('refresh') === '1'
    if (refresh && order.status === 'PENDING' && order.paymentProvider) {
      const ip = clientIp(req)
      if (!rateLimited(`order-refresh:${payload.id}:${orderNo}`, 10, 60_000) && !rateLimited(`order-refresh-ip:${ip}`, 30, 60_000)) {
        try {
          const providerName = order.paymentProvider as 'WECHAT' | 'YIPAY' | 'MOCK'
          const provider = getProvider(providerName)
          const result = await provider.queryPayment(orderNo)
          if (result.paid && result.amount === order.amount) {
            await confirmPaid(provider, {
              orderNo,
              tradeNo: result.tradeNo || '',
              transactionId: result.transactionId || '',
              amount: result.amount,
              channel: order.payChannel || 'wxpay',
              paid: true,
            })
            order.status = 'PAID'
          }
        } catch (e) {
          await logPayment(orderNo, order.paymentProvider, { status: 'ERROR', error: `主动查单失败: ${String(e)}` })
        }
      }
    }

    return ok({
      orderNo: order.orderNo,
      packageName: order.packageName,
      period: order.period,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      payMethod: order.payMethod,
      payChannel: order.payChannel,
      paymentProvider: order.paymentProvider,
      transactionId: order.transactionId,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      name: order.name,
      phone: order.phone,
      company: order.company,
      remark: order.remark,
      package: order.package,
    })
  })
}
