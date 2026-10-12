/**
 * 支付可插拔架构 —— 核心类型与 Provider 接口
 *
 * 业务层（订单创建/查询/退款/回调）只依赖 PaymentService，
 * 不直接调用任何具体支付渠道 API。
 * 未来新增渠道只需实现 PaymentProvider 并在 registry 注册。
 */

export type PayChannel = 'wxpay' | 'alipay' | 'qqpay'

export type PaymentProviderName = 'YIPAY' | 'WECHAT' | 'MOCK'

/** 发起支付请求参数 */
export type CreatePaymentInput = {
  orderNo: string
  amount: number // 单位：分
  subject: string
  channel: PayChannel // 用户选择的支付方式
  clientIp: string
  /** 支付设备环境：pc 扫码 / mobile 手机浏览器 / wechat 微信内 / alipay 支付宝内 */
  device?: 'pc' | 'mobile' | 'wechat' | 'alipay'
  // 小程序 JSAPI 支付需要
  openid?: string
  appid?: string
  // 返回页（易支付 return_url）
  returnUrl?: string
}

/** 发起支付结果 */
export type CreatePaymentResult = {
  /** 支付形态：qrcode 二维码 / jump 跳转URL / jsapi 小程序参数 / html */
  payType: 'qrcode' | 'jump' | 'jsapi' | 'html' | 'app'
  /** 二维码内容 或 跳转 URL */
  payInfo?: string
  /** 微信/易支付 JSAPI 唤起参数 */
  jsapiParams?: {
    appId?: string
    timeStamp?: string
    nonceStr?: string
    package?: string
    signType?: string
    paySign?: string
  }
  /** 平台/渠道订单号 */
  tradeNo?: string
}

/** 订单查询结果 */
export type QueryPaymentResult = {
  paid: boolean
  tradeNo?: string
  transactionId?: string
  amount?: number
  status?: string
  raw?: unknown
}

export type RefundInput = {
  orderNo: string
  refundNo: string // 商户退款单号（幂等键）
  amount: number // 单位：分
  reason?: string
}

export type RefundResult = {
  success: boolean
  refundNo?: string // 平台退款单号
  outRefundNo?: string
  amount?: number
  raw?: unknown
}

/** 回调验签结果 */
export type NotifyVerifyResult = {
  orderNo: string
  tradeNo: string
  transactionId: string
  amount: number // 单位：分
  channel: string
  paid: boolean
}

/** 支付渠道 Provider 接口 */
export interface PaymentProvider {
  readonly name: PaymentProviderName
  /** 发起支付 */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
  /** 主动查询支付状态 */
  queryPayment(orderNo: string): Promise<QueryPaymentResult>
  /** 退款 */
  refundPayment(input: RefundInput): Promise<RefundResult>
  /**
   * 回调验签：校验签名/商户号/金额，返回可信结果。
   * 验签失败返回 null（调用方应忽略该回调）。
   */
  verifyNotify(params: Record<string, string>): Promise<NotifyVerifyResult | null>
}
