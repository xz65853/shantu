import { getWechatSettings } from './wechat-settings'

/**
 * 微信小程序服务端接口封装：
 * - jscode2session：wx.login 的 code 换 openid / session_key
 * - getStableAccessToken：接口调用凭据（内存缓存，提前 5 分钟刷新）
 * - getPhoneNumber：手机号快速验证组件 code 换手机号
 */

const CACHE_KEY = 'wx:access_token'
const cache = new Map<string, { value: string; expiresAt: number }>()

type WxError = { errcode?: number; errmsg?: string }

async function wxGet<T>(url: string): Promise<T & WxError> {
  const res = await fetch(url, { cache: 'no-store' })
  return (await res.json()) as T & WxError
}

async function wxPost<T>(url: string, data: unknown): Promise<T & WxError> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  })
  return (await res.json()) as T & WxError
}

/** 获取小程序全局唯一后台接口调用凭据 access_token */
export async function getStableAccessToken(): Promise<string> {
  const cached = cache.get(CACHE_KEY)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const { wxapp_appid: appid, wxapp_secret: secret } = await getWechatSettings()
  if (!appid || !secret) throw new Error('小程序 AppID/AppSecret 未配置')

  const data = await wxPost<{ access_token?: string; expires_in?: number }>(
    'https://api.weixin.qq.com/cgi-bin/stable_token',
    { grant_type: 'client_credential', appid, secret },
  )
  if (!data.access_token) {
    throw new Error(`获取 access_token 失败: ${data.errcode} ${data.errmsg}`)
  }
  cache.set(CACHE_KEY, {
    value: data.access_token,
    expiresAt: Date.now() + Math.max((data.expires_in ?? 7200) - 300, 60) * 1000,
  })
  return data.access_token
}

/** code 换用户唯一标识 */
export async function code2Session(code: string): Promise<{
  openid: string
  unionid?: string
  session_key?: string
}> {
  const { wxapp_appid: appid, wxapp_secret: secret } = await getWechatSettings()
  if (!appid || !secret) throw new Error('小程序 AppID/AppSecret 未配置')

  const data = await wxGet<{ openid?: string; unionid?: string; session_key?: string }>(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`,
  )
  if (!data.openid) {
    throw new Error(`微信登录失败: ${data.errcode ?? ''} ${data.errmsg ?? 'code 无效'}`)
  }
  return { openid: data.openid, unionid: data.unionid, session_key: data.session_key }
}

/** 手机号快速验证：code 换手机号（需小程序认证） */
export async function getPhoneNumberByCode(code: string): Promise<string> {
  const token = await getStableAccessToken()
  const data = await wxPost<{ phone_info?: { phoneNumber?: string; purePhoneNumber?: string } }>(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${token}`,
    { code },
  )
  const phone = data.phone_info?.purePhoneNumber || data.phone_info?.phoneNumber
  if (!phone) {
    throw new Error(`获取手机号失败: ${data.errcode ?? ''} ${data.errmsg ?? 'code 无效'}`)
  }
  return phone
}
