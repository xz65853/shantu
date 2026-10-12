import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { guard, handle, ok, fail } from '@/lib/api'
import { confirmPaid, getProvider, logPayment } from '@/lib/payment/PaymentService'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * 手动同步支付状态（后台订单详情「同步支付状态」按钮）
 * 主动调微信/易支付查询接口，把最新状态拉回并幂等确认。
 * 仅对 PENDING 订单生效；已支付/已取消订单直接返回当前状态。
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { error } = await guard('orders')
  if (error) return error

  const { id } = await ctx.params
  return handle(async () => {
    const order = await prisma.order.findUnique({ where: { id: Number(id) } })
    if (!order) return fail('订单不存在', 404)

    // 已支付/已取消无需同步
    if (order.status === 'PAID') return ok({ status: 'PAID', changed: false }, '订单已支付')
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      return ok({ status: order.status, changed: false }, '订单已关闭，无需同步')
    }

    // 没有支付渠道记录（纯线下单）无法查单
    if (!order.paymentProvider) {
      return fail('该订单未发起过线上支付，无法同步', 400)
    }

    const providerName = order.paymentProvider as 'WECHAT' | 'YIPAY' | 'MOCK'
    const provider = getProvider(providerName)

    let result
    try {
      result = await provider.queryPayment(order.orderNo)
    } catch (e) {
      await logPayment(order.orderNo, providerName, { status: 'ERROR', error: `手动同步查单失败: ${String(e)}` })
      return fail(`查询支付状态失败：${(e as Error)?.message || '渠道异常'}`, 502)
    }

    if (!result.paid) {
      return ok(
        { status: order.status, changed: false, channelStatus: result.status || 'UNKNOWN' },
        `渠道状态：${result.status || '未支付'}，订单仍为待支付`,
      )
    }

    // 金额一致性校验（防止篡改）
    if (result.amount != null && result.amount !== order.amount) {
      await logPayment(order.orderNo, providerName, { status: 'ERROR', error: `手动同步金额不一致: 渠道${result.amount} vs 订单${order.amount}` })
      return fail('渠道支付金额与订单不一致，已阻断，请人工核实', 409)
    }

    // 幂等确认（事务改单 + 写流水 + 自动创建项目）
    const out = await confirmPaid(provider, {
      orderNo: order.orderNo,
      tradeNo: result.tradeNo || '',
      transactionId: result.transactionId || '',
      amount: result.amount ?? order.amount,
      channel: order.payChannel || 'wxpay',
      paid: true,
    })

    if (!out.ok) return fail(out.reason || '同步失败', 400)

    return ok(
      { status: 'PAID', changed: !out.duplicated, paidAt: new Date() },
      out.duplicated ? '订单已支付（状态一致）' : '同步成功，订单已更新为已支付',
    )
  })
}
