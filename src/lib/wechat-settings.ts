import crypto from 'crypto'
import { prisma } from './db'
import { appEncryptionKey } from './app-crypto-key'
import {
  DEFAULT_WECHAT_SETTINGS,
  MASK_PREFIX,
  WECHAT_KEYS,
  WECHAT_PUBLIC_KEYS,
  WECHAT_SECRET_KEYS,
} from './wechat-fields'

/**
 * 微信小程序 + 微信支付 配置的读写（服务端专用）
 *
 * 复用 site_settings（key/value）表，统一前缀 wxapp_ / wxpay_，避免新增表。
 * 敏感字段（AppSecret、API v3 密钥、商户私钥）落库前用 AES-256-GCM 加密，
 * 后台回显只给掩码，不回传明文。
 */

const ALGO = 'aes-256-gcm'
const ENC_PREFIX = 'enc:v1:'

/**
 * 数据加密密钥取自统一入口 appEncryptionKey()：
 * 优先 APP_ENC_KEY，迁移期回退 AUTH_SECRET，两者皆缺失则抛错。
 * 详见 app-crypto-key.ts 中的设计说明。
 */

/** key 可显式传入，用于让调用方能自行决定「配置故障是否允许被兜底 catch 吞掉」 */
export function encryptSecret(plain: string, key?: Buffer): string {
  if (!plain) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key || appEncryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `${ENC_PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

export function decryptSecret(stored: string, key?: Buffer): string {
  if (!stored) return ''
  // 兼容历史明文
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
    // 解密失败返回空串：密文损坏或密钥已轮换，交给调用方按「未配置」处理
    return ''
  }
}

export function maskSecret(value: string): string {
  if (!value) return ''
  return `${MASK_PREFIX}${value.slice(-4)}`
}

/** 空值或掩码 → 视为「不修改」 */
export function isMasked(value: string): boolean {
  return !value || value.startsWith(MASK_PREFIX)
}

/** 明文读取（服务端调用微信接口时使用） */
export async function getWechatSettings(): Promise<Record<string, string>> {
  const map: Record<string, string> = { ...DEFAULT_WECHAT_SETTINGS }
  // 在 try 之外解析密钥：密钥缺失属于致命配置故障，必须显式抛出。
  // 若在 try 内解析，会被下方「表未就绪」的兜底 catch 静默吞掉，
  // 表现为「支付配置看起来是空的」——极难排查。
  const key = appEncryptionKey()
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: WECHAT_KEYS } } })
    for (const row of rows) {
      const raw = row.value ?? ''
      map[row.key] = WECHAT_SECRET_KEYS.includes(row.key) ? decryptSecret(raw, key) : raw
    }
  } catch {
    /* 表未就绪时返回默认值 */
  }
  return map
}

/** 后台展示用：敏感字段替换为掩码 */
export async function getWechatSettingsMasked(): Promise<Record<string, string>> {
  const all = await getWechatSettings()
  for (const key of WECHAT_SECRET_KEYS) {
    all[key] = maskSecret(all[key])
  }
  return all
}

export async function saveWechatSettings(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    if (!WECHAT_KEYS.includes(key)) continue
    if (WECHAT_SECRET_KEYS.includes(key) && isMasked(value)) continue
    const stored = WECHAT_SECRET_KEYS.includes(key) ? encryptSecret(value) : value
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value: stored },
      create: { key, value: stored },
    })
  }
}

/** 小程序端可读取的公开配置（不含任何密钥） */
export async function getWechatPublicConfig() {
  const all = await getWechatSettings()
  const out: Record<string, string> = {}
  for (const key of WECHAT_PUBLIC_KEYS) out[key] = all[key] ?? ''
  return out
}

// 便于其他模块按需引用
export { WECHAT_KEYS, WECHAT_SECRET_KEYS }
