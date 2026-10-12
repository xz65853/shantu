import crypto from 'crypto'
import fs from 'fs'
import { getWechatSettings } from './wechat-settings'

/**
 * 微信支付 API v3 直连商户对接
 *
 * - Native 支付：官网扫码支付（返回 code_url，前端生成二维码）
 * - JSAPI 支付：小程序内唤起支付（需要用户 openid）
 * - 回调：解密 resource（AES-256-GCM，密钥为 APIv3 密钥）后更新订单
 *
 * 商户配置来自「小程序设置 → 微信支付」：
 *   wxpay_mchid / wxpay_cert_serial / wxpay_private_key / wxpay_api_v3_key / wxpay_notify_url / wxapp_appid
 */

export type WxpayConfig = {
  appid: string
  mchid: string
  serialNo: string
  privateKey: string
  apiV3Key: string
  notifyUrl: string
}

/** 私钥支持两种写法：PEM 全文，或服务器上的私钥文件路径 */
function resolvePrivateKey(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (trimmed.includes('-----BEGIN')) return trimmed
  // 视为文件路径
  if (/^[\w./-]+$/.test(trimmed)) {
    try {
      if (fs.existsSync(trimmed)) return fs.readFileSync(trimmed, 'utf8')
    } catch {
      /* 读取失败返回空 */
    }
  }
  return ''
}

export async function getWxpayConfig(): Promise<WxpayConfig | null> {
  const w = await getWechatSettings()
  if (w.wxpay_enable !== '1') return null
  const privateKey = resolvePrivateKey(w.wxpay_private_key)
  if (!w.wxpay_mchid || !privateKey) return null
  return {
    appid: w.wxapp_appid || '',
    mchid: w.wxpay_mchid,
    serialNo: w.wxpay_cert_serial || '',
    privateKey,
    apiV3Key: w.wxpay_api_v3_key,
    notifyUrl:
      w.wxpay_notify_url ||
      `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/pay/wxpay/notify`,
  }
}

function rsaSign(cfg: WxpayConfig, message: string): string {
  return crypto.createSign('RSA-SHA256').update(message).sign(cfg.privateKey, 'base64')
}

/** 构造 Authorization 头 */
function buildAuth(cfg: WxpayConfig, method: string, urlPath: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = crypto.randomBytes(16).toString('hex')
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = rsaSign(cfg, message)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`
}

async function wxpayPost<T>(cfg: WxpayConfig, urlPath: string, body: Record<string, unknown>): Promise<T> {
  const payload = JSON.stringify(body)
  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: buildAuth(cfg, 'POST', urlPath, payload),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'zh-CN',
      'User-Agent': 'shantu-web/1.0',
    },
    body: payload,
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text)
  } catch {
    json = { message: text }
  }
  if (!res.ok) {
    throw new Error(String(json.message || json.code || `微信支付接口错误 ${res.status}`))
  }
  return json as T
}

/** Native 下单：返回 code_url（前端生成二维码） */
export async function wxpayNative(
  cfg: WxpayConfig,
  opts: { orderNo: string; description: string; amount: number },
): Promise<string> {
  const data = await wxpayPost<{ code_url?: string }>(cfg, '/v3/pay/transactions/native', {
    appid: cfg.appid,
    mchid: cfg.mchid,
    description: opts.description.slice(0, 60),
    out_trade_no: opts.orderNo,
    notify_url: cfg.notifyUrl,
    amount: { total: opts.amount, currency: 'CNY' },
  })
  if (!data.code_url) throw new Error('微信支付下单未返回 code_url')
  return data.code_url
}

/** JSAPI 下单：返回 prepay_id（小程序唤起支付用） */
export async function wxpayJsapi(
  cfg: WxpayConfig,
  opts: { orderNo: string; description: string; amount: number; openid: string },
): Promise<string> {
  const data = await wxpayPost<{ prepay_id?: string }>(cfg, '/v3/pay/transactions/jsapi', {
    appid: cfg.appid,
    mchid: cfg.mchid,
    description: opts.description.slice(0, 60),
    out_trade_no: opts.orderNo,
    notify_url: cfg.notifyUrl,
    amount: { total: opts.amount, currency: 'CNY' },
    payer: { openid: opts.openid },
  })
  if (!data.prepay_id) throw new Error('微信支付下单未返回 prepay_id')
  return data.prepay_id
}

/** H5 下单：返回 h5_url（手机浏览器跳转唤起微信支付，微信内也可用） */
export async function wxpayH5(
  cfg: WxpayConfig,
  opts: { orderNo: string; description: string; amount: number; clientIp: string },
): Promise<string> {
  const data = await wxpayPost<{ h5_url?: string }>(cfg, '/v3/pay/transactions/h5', {
    appid: cfg.appid,
    mchid: cfg.mchid,
    description: opts.description.slice(0, 60),
    out_trade_no: opts.orderNo,
    notify_url: cfg.notifyUrl,
    amount: { total: opts.amount, currency: 'CNY' },
    scene_info: {
      payer_client_ip: opts.clientIp || '127.0.0.1',
      h5_info: { type: 'Wap' },
    },
  })
  if (!data.h5_url) throw new Error('微信支付下单未返回 h5_url')
  return data.h5_url
}

/** 小程序调起支付所需参数 */
export function buildMiniPayParams(cfg: WxpayConfig, prepayId: string) {
  const timeStamp = String(Math.floor(Date.now() / 1000))
  const nonceStr = crypto.randomBytes(16).toString('hex')
  const pkg = `prepay_id=${prepayId}`
  const message = `${cfg.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`
  const paySign = rsaSign(cfg, message)
  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA' as const,
    paySign,
  }
}

export type WxpayNotifyResource = {
  out_trade_no?: string
  transaction_id?: string
  trade_state?: string
  trade_state_desc?: string
  amount?: { total?: number; currency?: string }
}

/** AES-256-GCM 解密（密钥为 APIv3 密钥），返回明文字符串 */
export function decryptAesGcm(apiV3Key: string, resource: {
  ciphertext: string
  nonce: string
  associated_data?: string
}): string {
  const ciphertext = Buffer.from(resource.ciphertext, 'base64')
  const authTag = ciphertext.subarray(ciphertext.length - 16)
  const data = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), resource.nonce)
  decipher.setAuthTag(authTag)
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/** 解密回调 resource（AES-256-GCM，密钥为 APIv3 密钥） */
export function decryptNotifyResource(apiV3Key: string, resource: {
  ciphertext: string
  nonce: string
  associated_data?: string
}): WxpayNotifyResource {
  return JSON.parse(decryptAesGcm(apiV3Key, resource)) as WxpayNotifyResource
}

// ---------------- 平台证书（回调验签用） ----------------

let platformCertCache: { certs: Map<string, string>; fetchedAt: number } | null = null

/** 下载并缓存微信支付平台证书（serial_no → PEM），缓存 1 小时 */
export async function getPlatformCertificates(cfg: WxpayConfig): Promise<Map<string, string>> {
  if (platformCertCache && Date.now() - platformCertCache.fetchedAt < 3600_000) {
    return platformCertCache.certs
  }
  const urlPath = '/v3/certificates'
  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    headers: {
      Authorization: buildAuth(cfg, 'GET', urlPath, ''),
      Accept: 'application/json',
      'Accept-Language': 'zh-CN',
      'User-Agent': 'shantu-web/1.0',
    },
  })
  const json = (await res.json()) as {
    data?: { serial_no: string; encrypt_certificate: { ciphertext: string; nonce: string; associated_data?: string } }[]
  }
  const certs = new Map<string, string>()
  for (const item of json.data || []) {
    try {
      certs.set(item.serial_no, decryptAesGcm(cfg.apiV3Key, item.encrypt_certificate))
    } catch {
      /* 单个证书解密失败跳过 */
    }
  }
  if (certs.size > 0) platformCertCache = { certs, fetchedAt: Date.now() }
  return certs
}

/**
 * 校验微信支付回调签名（Wechatpay-Signature）。
 * 验签失败必须拒绝处理回调。证书获取失败时返回 false，微信会重推。
 */
export async function verifyWxpayNotifySignature(
  cfg: WxpayConfig,
  headers: { timestamp: string; nonce: string; signature: string; serial: string },
  rawBody: string,
): Promise<boolean> {
  try {
    if (!headers.timestamp || !headers.nonce || !headers.signature || !headers.serial) return false
    const certs = await getPlatformCertificates(cfg)
    const certPem = certs.get(headers.serial)
    if (!certPem) return false
    const message = `${headers.timestamp}\n${headers.nonce}\n${rawBody}\n`
    return crypto.createVerify('RSA-SHA256').update(message).verify(certPem, headers.signature, 'base64')
  } catch {
    return false
  }
}

// ---------------- 主动查单 / 退款 ----------------

export type WxpayOrderInfo = {
  out_trade_no?: string
  transaction_id?: string
  trade_state?: string
  trade_state_desc?: string
  amount?: { total?: number; currency?: string }
}

async function wxpayGet<T>(cfg: WxpayConfig, urlPath: string): Promise<T> {
  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    headers: {
      Authorization: buildAuth(cfg, 'GET', urlPath, ''),
      Accept: 'application/json',
      'Accept-Language': 'zh-CN',
      'User-Agent': 'shantu-web/1.0',
    },
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text)
  } catch {
    json = { message: text }
  }
  if (!res.ok) {
    throw new Error(String(json.message || json.code || `微信支付接口错误 ${res.status}`))
  }
  return json as T
}

/** 按商户订单号查询支付结果（回调丢失时的兜底手段） */
export async function wxpayQueryOrder(cfg: WxpayConfig, orderNo: string): Promise<WxpayOrderInfo> {
  // 注意：GET 签名串中的 URL 必须包含 query 部分
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${cfg.mchid}`
  return wxpayGet<WxpayOrderInfo>(cfg, urlPath)
}

/** 申请退款：返回平台退款单号 refund_id */
export async function wxpayRefund(
  cfg: WxpayConfig,
  opts: { orderNo: string; outRefundNo: string; amount: number; total: number; reason?: string },
): Promise<{ refund_id?: string; status?: string }> {
  return wxpayPost<{ refund_id?: string; status?: string }>(cfg, '/v3/refund/domestic/refunds', {
    out_trade_no: opts.orderNo,
    out_refund_no: opts.outRefundNo,
    reason: (opts.reason || '商户后台退款').slice(0, 80),
    amount: { refund: opts.amount, total: opts.total, currency: 'CNY' },
  })
}
