import crypto from 'crypto'
import fs from 'fs'
import { getPaymentSettings } from '@/lib/payment-settings'
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
 * 易支付（聚合支付平台 V2，RSA 签名）Provider
 *
 * 协议要点（来自官方文档 http://47.111.128.91:5/doc/）：
 * - 签名算法 SHA256WithRSA（商户私钥签名；回调用平台公钥验签）
 * - sign_type=RSA，新增 timestamp（10 位秒）
 * - 统一下单 POST /api/pay/create（method=web|jump|jsapi|app|scan|applet）
 * - 支付方式 type：alipay / wxpay / qqpay
 * - 回调 GET，trade_status=TRADE_SUCCESS，返回纯文本 success
 *
 * 配置来源：环境变量优先，其次后台「支付设置」里的 pay_epay_*（私钥加密存储）。
 */

type YipayConfig = {
  apiUrl: string
  pid: string
  merchantPrivateKey: string
  platformPublicKey: string
}

function resolveKey(raw: string): string {
  if (!raw) return ''
  const t = raw.trim()
  if (t.includes('-----BEGIN')) return t
  // 视为文件路径
  if (/^[\w./-]+$/.test(t)) {
    try {
      if (fs.existsSync(t)) return fs.readFileSync(t, 'utf8')
    } catch {
      /* 忽略 */
    }
  }
  return ''
}

async function getConfig(): Promise<YipayConfig | null> {
  const pay = await getPaymentSettings()
  if (pay.pay_epay_enable !== '1') return null
  const apiUrl = (process.env.YIPAY_API_URL || pay.pay_epay_url || '').replace(/\/+$/, '')
  const pid = process.env.YIPAY_PID || pay.pay_epay_pid || ''
  const merchantPrivateKey = resolveKey(process.env.YIPAY_MERCHANT_PRIVATE_KEY || pay.pay_epay_private_key || '')
  const platformPublicKey = resolveKey(process.env.YIPAY_PLATFORM_PUBLIC_KEY || pay.pay_epay_public_key || '')
  if (!apiUrl || !pid || !merchantPrivateKey) return null
  return { apiUrl, pid, merchantPrivateKey, platformPublicKey }
}

function rsaSign(privateKey: string, message: string): string {
  return crypto.createSign('RSA-SHA256').update(message, 'utf8').sign(privateKey, 'base64')
}

function rsaVerify(publicKey: string, message: string, signature: string): boolean {
  try {
    return crypto.createVerify('RSA-SHA256').update(message, 'utf8').verify(publicKey, signature, 'base64')
  } catch {
    return false
  }
}

/** 待签字符串：非空参数（剔除 sign/sign_type）按键 ASCII 升序拼接 */
function buildSignString(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([k, v]) => k !== 'sign' && k !== 'sign_type' && v !== '' && v !== undefined && v !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

async function postForm<T>(url: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(params).toString()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text)
  } catch {
    json = { msg: text }
  }
  if (!res.ok) throw new Error(String(json.msg || `易支付接口错误 ${res.status}`))
  return json as T
}

export class YipayProvider implements PaymentProvider {
  readonly name = 'YIPAY' as const

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const cfg = await getConfig()
    if (!cfg) throw new Error('易支付渠道未开启或配置不完整（需商户ID与商户私钥）')

    const isJsapi = Boolean(input.openid && input.appid)
    const params: Record<string, string> = {
      pid: cfg.pid,
      method: isJsapi ? 'jsapi' : 'web',
      type: input.channel === 'alipay' ? 'alipay' : input.channel === 'qqpay' ? 'qqpay' : 'wxpay',
      out_trade_no: input.orderNo,
      notify_url: `${siteUrl()}/api/payment/yipay/notify`,
      return_url: input.returnUrl || `${siteUrl()}/pay/result`,
      name: input.subject.slice(0, 60),
      money: (input.amount / 100).toFixed(2),
      clientip: input.clientIp || '127.0.0.1',
      timestamp: String(Math.floor(Date.now() / 1000)),
      sign_type: 'RSA',
    }
    if (isJsapi) {
      params.sub_openid = input.openid!
      params.sub_appid = input.appid!
    }
    params.sign = rsaSign(cfg.merchantPrivateKey, buildSignString(params))

    const data = await postForm<{
      code: number
      msg?: string
      trade_no?: string
      pay_type?: string
      pay_info?: string
    }>(`${cfg.apiUrl}/api/pay/create`, params)

    if (data.code !== 0) throw new Error(data.msg || '易支付下单失败')

    const payType = data.pay_type || 'jump'
    const payInfo = data.pay_info || ''

    if (payType === 'jsapi') {
      let js: Record<string, string> = {}
      try {
        js = JSON.parse(payInfo)
      } catch {
        /* 非 JSON 则跳过 */
      }
      return {
        payType: 'jsapi',
        tradeNo: data.trade_no,
        jsapiParams: {
          appId: js.appId || input.appid,
          timeStamp: js.timeStamp,
          nonceStr: js.nonceStr,
          package: js.package,
          signType: js.signType || 'RSA',
          paySign: js.paySign,
        },
      }
    }
    if (payType === 'qrcode') return { payType: 'qrcode', payInfo, tradeNo: data.trade_no }
    if (payType === 'html') return { payType: 'html', payInfo, tradeNo: data.trade_no }
    return { payType: 'jump', payInfo, tradeNo: data.trade_no }
  }

  async queryPayment(orderNo: string): Promise<QueryPaymentResult> {
    const cfg = await getConfig()
    if (!cfg) throw new Error('易支付未配置')
    const params: Record<string, string> = {
      pid: cfg.pid,
      out_trade_no: orderNo,
      timestamp: String(Math.floor(Date.now() / 1000)),
      sign_type: 'RSA',
    }
    params.sign = rsaSign(cfg.merchantPrivateKey, buildSignString(params))
    const data = await postForm<{ code: number; status?: number; trade_no?: string; money?: string; api_trade_no?: string }>(
      `${cfg.apiUrl}/api/pay/query`,
      params,
    )
    if (data.code !== 0) throw new Error('查询订单失败')
    return {
      paid: data.status === 1,
      tradeNo: data.trade_no,
      transactionId: data.api_trade_no,
      amount: data.money ? Math.round(Number(data.money) * 100) : undefined,
      status: String(data.status),
    }
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const cfg = await getConfig()
    if (!cfg) throw new Error('易支付未配置')
    const params: Record<string, string> = {
      pid: cfg.pid,
      out_trade_no: input.orderNo,
      money: (input.amount / 100).toFixed(2),
      out_refund_no: input.refundNo,
      timestamp: String(Math.floor(Date.now() / 1000)),
      sign_type: 'RSA',
    }
    params.sign = rsaSign(cfg.merchantPrivateKey, buildSignString(params))
    const data = await postForm<{ code: number; msg?: string; refund_no?: string; out_refund_no?: string; money?: string }>(
      `${cfg.apiUrl}/api/pay/refund`,
      params,
    )
    if (data.code !== 0) throw new Error(data.msg || '退款失败')
    return {
      success: true,
      refundNo: data.refund_no,
      outRefundNo: data.out_refund_no || input.refundNo,
      amount: data.money ? Math.round(Number(data.money) * 100) : input.amount,
      raw: data,
    }
  }

  /** 回调验签：平台公钥验签 + 商户号匹配 + trade_status 判断 */
  async verifyNotify(params: Record<string, string>): Promise<NotifyVerifyResult | null> {
    const cfg = await getConfig()
    if (!cfg) return null
    if (params.pid && params.pid !== cfg.pid) return null
    if (!cfg.platformPublicKey) {
      // 未配置平台公钥时无法验签 —— 绝不放行
      return null
    }
    const sign = String(params.sign || '')
    if (!sign) return null
    if (!rsaVerify(cfg.platformPublicKey, buildSignString(params), sign)) return null

    const tradeStatus = String(params.trade_status || '')
    const paid = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED'
    const orderNo = String(params.out_trade_no || '')
    const money = Number(params.money || 0)
    if (!orderNo) return null

    return {
      orderNo,
      tradeNo: String(params.trade_no || ''),
      transactionId: String(params.api_trade_no || params.trade_no || ''),
      amount: Math.round(money * 100),
      channel: String(params.type || ''),
      paid,
    }
  }
}
