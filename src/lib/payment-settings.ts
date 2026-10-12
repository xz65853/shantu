import crypto from 'crypto'
import { prisma } from './db'
import { appEncryptionKey } from './app-crypto-key'

/**
 * 在线支付配置（复用 site_settings，pay_ 前缀）
 *
 * 支持的收款渠道：
 * - 微信支付：① 收款码（pay_wechat_qrcode）② 微信支付 v3 线上支付（pay_wxpay_online_enable）
 * - 支付宝：收款码（pay_alipay_qrcode）；线上直连待接入
 * - 易支付：第三方聚合网关（pay_epay_*），支持微信/支付宝通道，下单后跳转收银台
 * - 线下对接：顾问联系收款
 *
 * 敏感字段（易支付密钥）落库前 AES-256-GCM 加密，后台回显掩码。
 */

export const PAY_KEYS = [
  'pay_wechat_enable',
  'pay_alipay_enable',
  'pay_offline_enable',
  'pay_wechat_qrcode',
  'pay_alipay_qrcode',
  'pay_offline_tip',
  'pay_contact_name',
  'pay_contact_phone',
  'pay_note',
  // 微信支付 v3 线上支付
  'pay_wxpay_online_enable',
  // 易支付（聚合支付 V2，RSA 签名）
  'pay_epay_enable',
  'pay_epay_name',
  'pay_epay_url',
  'pay_epay_pid',
  'pay_epay_public_key', // 平台公钥（PEM，验签回调用）
  'pay_epay_private_key', // 商户私钥（PEM，签名用，加密存储）
  'pay_epay_return_url',
]

/** 需要加密存储的敏感字段 */
export const PAY_SECRET_KEYS = ['pay_epay_private_key']

export const DEFAULT_PAY_SETTINGS: Record<string, string> = {
  pay_wechat_enable: '0',
  pay_alipay_enable: '0',
  // 线下支付默认开启：保证网站现在就能正常走完下单流程
  pay_offline_enable: '1',
  pay_wechat_qrcode: '',
  pay_alipay_qrcode: '',
  pay_offline_tip: '提交订单后，我们的顾问会在 1 个工作日内与您联系，确认服务内容并协助完成付款与开通。',
  pay_contact_name: '',
  pay_contact_phone: '',
  pay_note: '',
  pay_wxpay_online_enable: '0',
  pay_epay_enable: '0',
  pay_epay_name: '易支付',
  pay_epay_url: '',
  pay_epay_pid: '',
  pay_epay_public_key: '',
  pay_epay_private_key: '',
  pay_epay_return_url: '',
}

const ALGO = 'aes-256-gcm'
const ENC_PREFIX = 'enc:v1:'
export const PAY_MASK = '••••••'

/**
 * 数据加密密钥取自统一入口 appEncryptionKey()，与 wechat-settings 共用同一套密钥策略。
 * 详见 app-crypto-key.ts 中的设计说明。
 */

export function encryptPaySecret(plain: string, key?: Buffer): string {
  if (!plain) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key || appEncryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `${ENC_PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

export function decryptPaySecret(stored: string, key?: Buffer): string {
  if (!stored) return ''
  if (!stored.startsWith(ENC_PREFIX)) return stored
  const parts = stored.split(':')
  if (parts.length !== 5) return ''
  try {
    const iv = Buffer.from(parts[2], 'base64')
    const tag = Buffer.from(parts[3], 'base64')
    const enc = Buffer.from(parts[4], 'base64')
    const decipher = crypto.createDecipheriv(ALGO, key || appEncryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}

/** 后台读取（敏感字段明文，供内部使用） */
export async function getPaymentSettings(): Promise<Record<string, string>> {
  const map: Record<string, string> = { ...DEFAULT_PAY_SETTINGS }
  // 同 getWechatSettings：密钥解析置于 try 外，避免配置故障被静默吞掉
  const key = appEncryptionKey()
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: PAY_KEYS } } })
    for (const row of rows) {
      const raw = row.value ?? ''
      map[row.key] = PAY_SECRET_KEYS.includes(row.key) ? decryptPaySecret(raw, key) : raw
    }
  } catch {
    /* 表未就绪时返回默认值 */
  }
  return map
}

/** 后台展示用：敏感字段替换为掩码 */
export async function getPaymentSettingsMasked(): Promise<Record<string, string>> {
  const all = await getPaymentSettings()
  for (const key of PAY_SECRET_KEYS) {
    all[key] = all[key] ? `${PAY_MASK}${all[key].slice(-4)}` : ''
  }
  return all
}

export async function savePaymentSettings(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    if (!PAY_KEYS.includes(key)) continue
    // 掩码或未填写 → 视为不修改
    if (PAY_SECRET_KEYS.includes(key) && (!value || value.startsWith(PAY_MASK))) continue
    const stored = PAY_SECRET_KEYS.includes(key) ? encryptPaySecret(value) : value
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value: stored },
      create: { key, value: stored },
    })
  }
}

/** 前台可用的支付渠道（不含任何密钥） */
export async function getPublicPaymentChannels() {
  const pay = await getPaymentSettings()
  const wx = await getWechatPayEnabled()
  return {
    wechat: pay.pay_wechat_enable === '1',
    alipay: pay.pay_alipay_enable === '1',
    epay: pay.pay_epay_enable === '1' && Boolean(pay.pay_epay_url && pay.pay_epay_pid && pay.pay_epay_key),
    epayName: pay.pay_epay_name || '易支付',
    offline: pay.pay_offline_enable === '1',
    wechatQrcode: pay.pay_wechat_qrcode,
    alipayQrcode: pay.pay_alipay_qrcode,
    // 微信支付 v3 线上支付（Native 扫码 / 小程序 JSAPI）
    wxpayOnline: wx,
    offlineTip: pay.pay_offline_tip,
    contactName: pay.pay_contact_name,
    contactPhone: pay.pay_contact_phone,
  }
}

/** 微信支付 v3 是否已配置完整（商户配置在「小程序设置 → 微信支付」） */
async function getWechatPayEnabled() {
  try {
    const { getWechatSettings } = await import('./wechat-settings')
    const w = await getWechatSettings()
    const pay = await getPaymentSettings()
    return (
      pay.pay_wxpay_online_enable === '1' &&
      w.wxpay_enable === '1' &&
      Boolean(w.wxpay_mchid && w.wxpay_api_v3_key && (w.wxpay_private_key || w.wxpay_cert_serial))
    )
  } catch {
    return false
  }
}
