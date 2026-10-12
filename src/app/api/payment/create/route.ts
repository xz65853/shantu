import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import { getMemberFromRequest } from '@/lib/member-auth'
import { getWechatSettings } from '@/lib/wechat-settings'
import { createPayment, pickProvider } from '@/lib/payment/PaymentService'
import type { PayChannel } from '@/lib/payment/types'
import { ensureContractForOrder } from '@/lib/contract-service'

const schema = z.object({
  orderNo: z.string().trim().min(6, '订单号错误').max(40),
  channel: z.enum(['wxpay', 'alipay', 'qqpay']).default('wxpay'),
  // 场景：web 官网 / mini 小程序
  scene: z.enum(['web', 'mini']).default('web'),
  // 设备环境（web 场景用）：pc 扫码 / mobile 手机浏览器 / wechat 微信内 / alipay 支付宝内
  device: z.enum(['pc', 'mobile', 'wechat', 'alipay']).default('pc'),
})

function clientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

/**
 * 统一发起支付（可插拔，智能路由）：
 * 前端只传 orderNo + channel + scene + device，
 * 服务端按渠道可用性选择 Provider（微信为主、易支付备选）并下单。
 * 金额以服务端订单为准，不接受前端传入金额。
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await parseBody(req, schema)

    const order = await prisma.order.findUnique({ where: { orderNo: body.orderNo } })
    if (!order) return fail('订单不存在', 404)
    if (order.status === 'PAID') return fail('该订单已支付', 400)
    if (order.status === 'CANCELLED') return fail('该订单已取消', 400)

    // 鉴权：登录会员只能支付自己的订单
    const payload = await getMemberFromRequest(req)
    if (order.memberId && (!payload || payload.id !== order.memberId)) {
      return fail('无权操作该订单', 403)
    }

    // 红线：未签合同不能支付（后端硬校验，前端拦截不算数）
    // 套餐订单必须先签署电子合同；合同缺失时兜底生成，再按状态拒绝
    if (order.packageId && order.type !== 'CUSTOM') {
      let contract = await prisma.contract.findUnique({ where: { orderId: order.id } })
      if (!contract) {
        try {
          contract = await ensureContractForOrder(order.id)
        } catch (e) {
          console.error('[payment] ensure contract failed', e instanceof Error ? e.stack : String(e))
        }
      }
      if (!contract) return fail('合同生成失败，请联系客服', 400)
      if (contract.status === 'VOID') return fail('合同已作废，请联系客服', 400)
      if (contract.status !== 'SIGNED') return fail('请先签署合同', 409, 409)
    }

    // 智能路由选择 Provider
    const providerName = await pickProvider(body.channel as PayChannel)
    if (!providerName) {
      return fail(body.channel === 'alipay' ? '支付宝暂未开通，请联系客服' : '支付渠道未开通，请联系客服', 400)
    }

    // 小程序 JSAPI 需要 openid + appid
    let openid: string | undefined
    let appid: string | undefined
    if (body.scene === 'mini' && providerName === 'WECHAT') {
      const member = order.memberId ? await prisma.member.findUnique({ where: { id: order.memberId } }) : null
      openid = member?.openId || undefined
      const wx = await getWechatSettings()
      appid = wx.wxapp_appid || undefined
      if (!openid) return fail('当前账号未绑定微信，无法发起微信支付', 400)
    }

    const result = await createPayment(providerName, order.id, {
      orderNo: order.orderNo,
      amount: order.amount,
      subject: order.packageName,
      channel: body.channel as PayChannel,
      clientIp: clientIp(req),
      device: body.device,
      openid,
      appid,
    })

    return ok({
      provider: providerName,
      ...result,
    })
  })
}
