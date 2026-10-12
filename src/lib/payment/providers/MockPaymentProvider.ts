import {
  type CreatePaymentInput,
  type CreatePaymentResult,
  type NotifyVerifyResult,
  type PaymentProvider,
  type QueryPaymentResult,
  type RefundInput,
  type RefundResult,
} from '../types'

/**
 * Mock 支付渠道（开发联调用）：不调用任何真实支付，也不伪造支付成功。
 * - createPayment 返回一个站内 mock 收银台地址，用户点「模拟支付成功」即触发站内回调
 * - verifyNotify 只接受由本站 /api/payment/mock/confirm 生成的确认参数
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const

  private base() {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // 返回站内 mock 收银台，金额与订单号通过 query 透传
    const payInfo = `${this.base()}/mock-pay?orderNo=${encodeURIComponent(input.orderNo)}&amount=${input.amount}&channel=${input.channel}`
    return { payType: 'jump', payInfo, tradeNo: `MOCK${Date.now()}` }
  }

  async queryPayment(orderNo: string): Promise<QueryPaymentResult> {
    // mock 无真实状态，交由业务层按订单状态判断
    return { paid: false, raw: { orderNo, mock: true } }
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    return { success: true, outRefundNo: input.refundNo, amount: input.amount, raw: { mock: true } }
  }

  /** mock 回调：仅信任明确带 mock_confirm 标记的参数 */
  async verifyNotify(params: Record<string, string>): Promise<NotifyVerifyResult | null> {
    if (params.mock_confirm !== '1') return null
    const orderNo = String(params.out_trade_no || '')
    const amount = Number(params.money || 0) * 100
    if (!orderNo || !amount) return null
    return {
      orderNo,
      tradeNo: String(params.trade_no || `MOCK${Date.now()}`),
      transactionId: String(params.trade_no || ''),
      amount: Math.round(amount),
      channel: String(params.type || 'wxpay'),
      paid: true,
    }
  }
}
