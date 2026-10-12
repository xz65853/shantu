import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import { getWxpayConfig, wxpayNative } from '@/lib/wxpay'
import { getPaymentSettings } from '@/lib/payment-settings'

const schema = z.object({
  orderNo: z.string().trim().min(6, '订单号错误').max(40),
  tail: z.string().trim().length(4, '请输入手机号后四位'),
})

/** 微信支付 v3 Native 下单：返回 code_url 供前端生成二维码 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await parseBody(req, schema)

    const pay = await getPaymentSettings()
    if (pay.pay_wxpay_online_enable !== '1') return fail('微信线上支付未开启', 400)

    const order = await prisma.order.findUnique({ where: { orderNo: body.orderNo } })
    if (!order) return fail('订单不存在', 404)
    if (!order.phone.endsWith(body.tail)) return fail('手机号后四位不正确', 403)
    if (order.status === 'PAID') return fail('该订单已支付', 400)
    if (order.status === 'CANCELLED') return fail('该订单已取消', 400)

    const cfg = await getWxpayConfig()
    if (!cfg) return fail('微信支付配置不完整，请在后台「小程序设置 → 微信支付」检查商户号与私钥', 400)
    if (!cfg.appid) return fail('未配置小程序 AppID，无法发起微信支付', 400)

    const codeUrl = await wxpayNative(cfg, {
      orderNo: order.orderNo,
      description: `${order.packageName} · ${order.name}`,
      amount: order.amount,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { payMethod: 'WECHAT' },
    })

    return ok({ codeUrl, orderNo: order.orderNo, amount: order.amount })
  })
}
