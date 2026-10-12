import { handle, ok, fail } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getPaymentSettings } from '@/lib/payment-settings'
import { isProviderReady } from '@/lib/payment/PaymentService'

type Ctx = { params: Promise<{ orderNo: string }> }

/** 前台查询订单（订单号 + 手机号后 4 位做简单校验，避免被遍历） */
export async function GET(req: Request, ctx: Ctx) {
  const { orderNo } = await ctx.params
  const url = new URL(req.url)
  const tail = (url.searchParams.get('tail') || '').trim()

  return handle(async () => {
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { package: true },
    })
    if (!order) return fail('订单不存在', 404)
    if (!tail || !order.phone.endsWith(tail) || tail.length !== 4) {
      return fail('订单号或手机号后四位不正确', 403)
    }

    const [wechatReady, yipayReady, pay] = await Promise.all([
      isProviderReady('WECHAT'),
      isProviderReady('YIPAY'),
      getPaymentSettings(),
    ])

    return ok({
      orderNo: order.orderNo,
      packageName: order.packageName,
      period: order.period,
      amount: order.amount,
      status: order.status,
      payMethod: order.payMethod,
      payChannel: order.payChannel,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      name: order.name,
      phone: order.phone,
      company: order.company,
      payment: {
        // 前台只展示「微信支付 / 支付宝」两个入口
        wechat: wechatReady || yipayReady || Boolean(pay.pay_wechat_qrcode),
        alipay: yipayReady || Boolean(pay.pay_alipay_qrcode),
        // 是否有真实线上渠道（决定走下单接口还是展示收款码）
        onlineWechat: wechatReady || yipayReady,
        onlineAlipay: yipayReady,
        wechatQrcode: pay.pay_wechat_qrcode,
        alipayQrcode: pay.pay_alipay_qrcode,
        offlineTip: pay.pay_offline_tip,
        contactName: pay.pay_contact_name,
        contactPhone: pay.pay_contact_phone,
      },
    })
  })
}
