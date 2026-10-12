import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import { confirmPaid, getProvider } from '@/lib/payment/PaymentService'

const schema = z.object({
  orderNo: z.string().trim().min(6).max(40),
})

/**
 * Mock 支付确认（仅开发联调用）：
 * 模拟支付成功后走与真实回调完全相同的 confirmPaid 幂等改单逻辑。
 *
 * 【安全】该接口无任何登录态与归属校验，一旦在生产可达，
 * 任何人只要拿到订单号即可把订单改成「已支付」，属于可直接白嫖的高危端点。
 * 因此改为 fail-closed：生产环境一律拒绝，开发环境也需显式开启开关。
 *
 * 开发联调如需启用，请在 .env 中设置 ENABLE_MOCK_PAYMENT=true（切勿在生产设置）。
 */
export async function POST(req: NextRequest) {
  // 双重保险：生产直接禁用；非生产也需显式开启
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_MOCK_PAYMENT !== 'true') {
    return fail('Mock 支付接口已禁用', 403, 403)
  }

  return handle(async () => {
    const body = await parseBody(req, schema)
    const order = await prisma.order.findUnique({ where: { orderNo: body.orderNo } })
    if (!order) return fail('订单不存在', 404)

    const out = await confirmPaid(getProvider('MOCK'), {
      orderNo: order.orderNo,
      tradeNo: `MOCK${Date.now()}`,
      transactionId: `MOCK${Date.now()}`,
      amount: order.amount,
      channel: 'wxpay',
      paid: true,
    })

    if (!out.ok) return fail(out.reason || '处理失败', 400)
    return ok({ duplicated: out.duplicated }, out.duplicated ? '该订单已支付（幂等）' : '模拟支付成功')
  })
}
