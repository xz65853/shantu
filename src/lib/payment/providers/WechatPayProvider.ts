import {
  buildMiniPayParams,
  getWxpayConfig,
  wxpayH5,
  wxpayJsapi,
  wxpayNative,
  wxpayQueryOrder,
  wxpayRefund,
  type WxpayConfig,
} from '@/lib/wxpay'
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
 * 微信支付（API v3 直连商户）Provider —— 官方微信主渠道
 * - 小程序（openid）：JSAPI 唤起支付
 * - PC 浏览器：Native 扫码（code_url → 二维码）
 * - 手机浏览器/微信内（H5）：H5 支付（h5_url → 跳转唤起微信支付）
 * - 回调：解密 resource（AES-256-GCM）后按 trade_state=SUCCESS 判定
 */
export class WechatPayProvider implements PaymentProvider {
  readonly name = 'WECHAT' as const

  private withNotifyUrl(cfg: WxpayConfig): WxpayConfig {
    return {
      ...cfg,
      notifyUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/payment/wxpay/notify`,
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const cfg = await getWxpayConfig()
    if (!cfg) throw new Error('微信支付未配置（商户号/APIv3密钥/商户私钥）')
    if (!cfg.appid) throw new Error('未配置小程序 AppID')

    const c = this.withNotifyUrl(cfg)
    const desc = { orderNo: input.orderNo, description: input.subject.slice(0, 60), amount: input.amount }

    // 小程序内：JSAPI 唤起
    if (input.openid) {
      const prepayId = await wxpayJsapi(c, { ...desc, openid: input.openid })
      const p = buildMiniPayParams(c, prepayId)
      return {
        payType: 'jsapi',
        jsapiParams: {
          appId: cfg.appid,
          timeStamp: p.timeStamp,
          nonceStr: p.nonceStr,
          package: p.package,
          signType: p.signType,
          paySign: p.paySign,
        },
      }
    }

    // PC：Native 扫码
    if (input.device === 'pc' || !input.device) {
      const codeUrl = await wxpayNative(c, desc)
      return { payType: 'qrcode', payInfo: codeUrl }
    }

    // 手机浏览器 / 微信内：优先 H5 支付（跳转唤起），商户未开通 H5 权限时降级 Native 扫码
    try {
      const h5Url = await wxpayH5(c, { ...desc, clientIp: input.clientIp })
      return { payType: 'jump', payInfo: h5Url }
    } catch {
      const codeUrl = await wxpayNative(c, desc)
      return { payType: 'qrcode', payInfo: codeUrl }
    }
  }

  /** 主动查询订单支付状态（回调丢失时兜底，小程序支付返回后也会触发） */
  async queryPayment(orderNo: string): Promise<QueryPaymentResult> {
    const cfg = await getWxpayConfig()
    if (!cfg) return { paid: false, status: 'NOT_CONFIGURED' }
    try {
      const data = await wxpayQueryOrder(cfg, orderNo)
      return {
        paid: data.trade_state === 'SUCCESS',
        tradeNo: data.transaction_id || undefined,
        transactionId: data.transaction_id || undefined,
        amount: data.amount?.total,
        status: data.trade_state,
        raw: data,
      }
    } catch {
      return { paid: false, status: 'QUERY_FAILED' }
    }
  }

  /** 微信退款（API v3），失败时抛错由后台提示具体原因，绝不伪造成功 */
  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const cfg = await getWxpayConfig()
    if (!cfg) throw new Error('微信支付未配置，无法自动退款')
    const data = await wxpayRefund(cfg, {
      orderNo: input.orderNo,
      outRefundNo: input.refundNo,
      amount: input.amount,
      total: input.amount,
      reason: input.reason,
    })
    return {
      success: Boolean(data.refund_id),
      refundNo: data.refund_id,
      outRefundNo: input.refundNo,
      amount: input.amount,
      raw: data,
    }
  }

  /** 微信回调验签 + 解密：返回可信结果 */
  async verifyNotify(_params: Record<string, string>): Promise<NotifyVerifyResult | null> {
    // 微信回调是 JSON body，不是 query 参数，本方法在 route 层单独处理
    // （见 /api/payment/wxpay/notify），此处返回 null 表示不通过通用路径。
    return null
  }
}

export type { WxpayConfig }
