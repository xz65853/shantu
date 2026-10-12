import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { encryptSecret, decryptSecret } from '@/lib/wechat-settings'
import { getStableAccessToken } from '@/lib/wechat-server'
import { getSettings } from '@/lib/settings'

/**
 * 实名认证服务层
 * ------------------------------------------------------------------
 * 渠道 1 —— 微信人脸核身（wechat_face，2.0 接口）：
 *   getVerifyId(姓名+身份证) → 前端 wx.requestFacialVerify({verifyId})
 *   → queryVerifyInfo(verifyId) 后端二次校验，errcode=0 且 verify_ret=10000 才算通过
 * 渠道 2 —— 二要素核验（manual_idcard，降级）：腾讯云市场二要素 / 阿里云市场二要素
 *
 * 红线：
 * - 身份证号 AES-256-GCM 加密落库，接口只返回脱敏
 * - 核身结果必须后端 queryVerifyInfo 二次校验，不信任前端
 * - 失败次数限制由调用方 rateLimited 控制（10 分钟 5 次）
 */

const IDCARD_RE = /^\d{17}[\dXx]$|^\d{15}$/
const NAME_RE = /^[\u4e00-\u9fa5·]{2,20}$|^[A-Za-z][A-Za-z .·-]{1,40}$/

export function isValidIdCard(no: string): boolean {
  return IDCARD_RE.test(no || '')
}

export function isValidName(name: string): boolean {
  return NAME_RE.test((name || '').trim())
}

/** 身份证脱敏：430***********1234 */
export function maskIdCard(no: string): string {
  if (!no) return ''
  if (no.length === 18) return `${no.slice(0, 3)}${'*'.repeat(11)}${no.slice(-4)}`
  if (no.length === 15) return `${no.slice(0, 3)}${'*'.repeat(8)}${no.slice(-4)}`
  return no.replace(/./g, '*')
}

export function encryptIdCard(no: string): string {
  return encryptSecret(no)
}

export function decryptIdCard(enc: string | null | undefined): string {
  return enc ? decryptSecret(enc) : ''
}

/** 身份证号归一：X 转大写 */
export function normalizeIdCard(no: string): string {
  return (no || '').trim().toUpperCase()
}

/** queryVerifyInfo 的 cert_hash 计算：base64 各字段 → 拼接 → SHA256 hex */
export function certHash(certInfo: { cert_type: string; cert_name: string; cert_no: string }): string {
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
  const joined = `cert_type=${b64(certInfo.cert_type)}&cert_name=${b64(certInfo.cert_name)}&cert_no=${b64(certInfo.cert_no)}`
  return crypto.createHash('sha256').update(joined, 'utf8').digest('hex')
}

/** 业务内部流水号：5-32 字符，仅数字/字母/_-，同一 appid 下唯一 */
export function genOutSeqNo(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return `TJRL${datePart}${Math.random().toString(36).slice(2, 10)}`
}

type WxError = { errcode?: number; errmsg?: string }

/** 人脸核身 2.0：获取会话唯一标识 verifyId */
export async function wechatGetVerifyId(params: {
  openid: string
  name: string
  idCard: string
}): Promise<{ verifyId: string; outSeqNo: string }> {
  const token = await getStableAccessToken()
  const outSeqNo = genOutSeqNo()
  const res = await fetch(
    `https://api.weixin.qq.com/cityservice/face/identify/getverifyid?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        out_seq_no: outSeqNo,
        cert_info: { cert_type: 'IDENTITY_CARD', cert_name: params.name, cert_no: params.idCard },
        openid: params.openid,
      }),
      cache: 'no-store',
    },
  )
  const data = (await res.json()) as WxError & { verify_id?: string; expires_in?: number }
  if (data.errcode !== 0 || !data.verify_id) {
    throw new Error(`人脸核身获取会话失败(${data.errcode ?? ''} ${data.errmsg ?? ''})`)
  }
  return { verifyId: data.verify_id, outSeqNo }
}

/** 人脸核身 2.0：查询真实验证结果（后端二次校验） */
export async function wechatQueryVerifyInfo(params: {
  verifyId: string
  outSeqNo: string
  name: string
  idCard: string
  openid: string
}): Promise<{ ok: boolean; verifyRet: number; errmsg: string }> {
  const token = await getStableAccessToken()
  const certInfo = { cert_type: 'IDENTITY_CARD', cert_name: params.name, cert_no: params.idCard }
  const res = await fetch(
    `https://api.weixin.qq.com/cityservice/face/identify/queryverifyinfo?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verify_id: params.verifyId,
        out_seq_no: params.outSeqNo,
        cert_hash: certHash(certInfo),
        openid: params.openid,
      }),
      cache: 'no-store',
    },
  )
  const data = (await res.json()) as WxError & { verify_ret?: number }
  const verifyRet = data.verify_ret ?? -1
  return {
    ok: data.errcode === 0 && verifyRet === 10000,
    verifyRet,
    errmsg: data.errmsg || '',
  }
}

/**
 * 二要素核验（姓名 + 身份证号一致）
 * 渠道由 site_settings 的 realname_channel 决定（与后台「实名认证配置」保存的键一致）：
 * - ''（默认）：未配置 → 抛错（提示管理员配置）
 * - 'mock'：仅测试环境放行（e2e 用）
 * - 'tencent'：腾讯云市场「身份证实名认证」二要素，读 realname_tencent_secret_id/key（加密存储）
 * - 'aliyun'：阿里云市场「身份证二要素核验」，读 realname_aliyun_appcode（加密存储）
 * 历史兼容：老键 idcard_verify_provider 仍可生效，便于灰度过渡；tencent_huyan 视为 tencent。
 */
export async function manualVerifyIdCard(
  name: string,
  idCard: string
): Promise<{ ok: boolean; transactionId: string; message: string }> {
  const settings = await getSettings()
  const channel = (settings.realname_channel || '').trim() || (settings.idcard_verify_provider || '').trim()

  if (channel === 'mock') {
    return { ok: true, transactionId: `MOCK${Date.now()}`, message: 'mock 放行' }
  }

  if (channel === 'aliyun') {
    const encAppCode = settings.realname_aliyun_appcode
    const appCode = encAppCode ? decryptSecret(encAppCode) : ''
    if (!appCode) throw new Error('阿里云二要素 AppCode 未配置，请联系管理员')
    return aliyunMarketIdCardVerify(name, idCard, appCode)
  }

  if (channel === 'tencent' || channel === 'tencent_huyan') {
    // tencent_huyan 为历史遗留值（旧慧眼占位），统一走腾讯云市场二要素
    const encSid = settings.realname_tencent_secret_id
    const encSkey = settings.realname_tencent_secret_key
    const secretId = encSid ? decryptSecret(encSid) : ''
    const secretKey = encSkey ? decryptSecret(encSkey) : ''
    if (!secretId || !secretKey) throw new Error('腾讯云市场密钥未配置，请联系管理员')
    const endpoint = settings.realname_tencent_endpoint?.trim() || TENCENT_MARKET_ID_CHECK_URL
    return tencentMarketIdCardVerify(name, idCard, secretId, secretKey, endpoint)
  }

  throw new Error('实名核验渠道未配置，请联系管理员')
}

/** 腾讯云市场「身份证实名认证」接口地址（商品 25386，北京区 service-hl92rg03） */
export const TENCENT_MARKET_ID_CHECK_URL =
  'https://ap-beijing.cloudmarket-apigw.com/service-hl92rg03/id/check'

/**
 * 腾讯云市场「身份证实名认证」二要素核验（腾讯云应用市场商品 25386）。
 * POST {endpoint}，Content-Type: application/x-www-form-urlencoded
 * body: cardNo=<身份证号>&realName=<姓名>（汉字 UrlEncode）
 *
 * 鉴权（云市场 API 网关密钥对，2026-09-28 实测通过）：
 *   签名串只有一行：`x-date: <GMT 时间>`，如 `x-date: Mon, 28 Sep 2026 09:36:17 GMT`
 *   signature = Base64(HMAC-SHA1(SecretKey, 签名串))
 *   Authorization: {"id":"<SecretId>","x-date":"<GMT>","signature":"<signature>"}
 *   注意 Authorization 必须是 JSON 字符串格式——标准 `hmac id="..."` 格式会被网关拒绝(414)。
 *
 * 返回：{ error_code, reason, result: { realname, idcard, isok, IdCardInfor }, sn }
 * - error_code === 0：通讯成功，再看 result.isok（true 一致 / false 不一致）
 * - error_code === 206501：库无（身份证查无记录，含军人/迁出/未换二代证等情形），按不一致处理
 * 网关错误码：402 签名不对；403 签名超时(查服务器时钟)；404 密钥失效；
 *            401 使用计划耗尽；427 SecretID 与所购商品不匹配。
 * 重试策略：网络错重试 1 次；业务错（不一致/库无）不重试。
 */
export async function tencentMarketIdCardVerify(
  name: string,
  idCard: string,
  secretId: string,
  secretKey: string,
  endpoint: string = TENCENT_MARKET_ID_CHECK_URL
): Promise<{ ok: boolean; transactionId: string; message: string }> {
  const xDate = new Date().toUTCString() // 形如 Mon, 28 Sep 2026 09:36:17 GMT，即 GMT 格式
  const signature = crypto
    .createHmac('sha1', secretKey)
    .update(`x-date: ${xDate}`, 'utf8')
    .digest('base64')
  // 红线：密钥只参与签名，Authorization 里只放 SecretId 与签名值
  const authorization = JSON.stringify({ id: secretId, 'x-date': xDate, signature })
  const body = `cardNo=${encodeURIComponent(idCard)}&realName=${encodeURIComponent(name)}`

  const call = async () => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'x-date': xDate,
        Authorization: authorization,
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const raw = await res.text()
    // 注意：该服务商返回的是二次序列化 JSON——响应体本身是 JSON 字符串
    // （形如 "{\"error_code\":0,...}"），需要 parse 两次才能得到对象
    let data:
      | {
          error_code?: number
          reason?: string
          result?: { isok?: boolean; realname?: string; idcard?: string } | null
          sn?: string
        }
      | string
      | null = null
    try {
      const first = JSON.parse(raw)
      data = typeof first === 'string' ? JSON.parse(first) : first
    } catch {
      /* 非 JSON 响应按错误处理 */
    }
    return { res, data, raw }
  }

  let out: Awaited<ReturnType<typeof call>>
  try {
    out = await call()
  } catch {
    // 网络错重试 1 次
    try {
      out = await call()
    } catch {
      throw new Error('实名核验通道网络异常，请稍后重试')
    }
  }

  const { res, data } = out
  if (!res.ok) {
    console.error('[realname] tencent market http error', res.status, out.raw.slice(0, 300))
    if (res.status === 402) throw new Error('实名核验密钥签名校验失败，请联系管理员核对密钥')
    if (res.status === 403) throw new Error('实名核验签名时间超时，请联系管理员检查服务器时钟')
    if (res.status === 404) throw new Error('实名核验密钥已失效，请联系管理员到腾讯云市场重新生成')
    if (res.status === 401) throw new Error('实名核验服务次数已用完，请联系管理员续费')
    if (res.status === 427 || (res.status >= 420 && res.status < 430)) {
      throw new Error('实名核验密钥与所购商品不匹配，请联系管理员到腾讯云市场核对')
    }
    throw new Error('实名核验通道配置异常，请联系管理员')
  }
  if (!data || typeof data !== 'object' || typeof data.error_code !== 'number') {
    console.error('[realname] tencent market bad payload', out.raw.slice(0, 300))
    throw new Error('实名核验通道返回异常，请稍后重试')
  }

  const transactionId = data.sn ? `TCMKT${data.sn}` : `TCMKT${Date.now()}`
  if (data.error_code === 0) {
    const isok = data.result?.isok === true
    return {
      ok: isok,
      transactionId,
      message: isok ? '认证一致' : '姓名与身份证号不一致，请核对后重试',
    }
  }
  // 业务错：不重试，直接返回失败原因
  if (data.error_code === 206501) {
    return { ok: false, transactionId, message: '身份证号查无记录，请核对后重试' }
  }
  return {
    ok: false,
    transactionId,
    message: data.reason ? `核验未通过（${data.reason}）` : '姓名与身份证号不一致，请核对后重试',
  }
}

/**
 * 阿里云市场「身份证实名认证」二要素核验（2026-09-28 实测通过）
 * POST https://zidv2.market.alicloudapi.com/idcheck/Post
 * Body: cardNo=<身份证号>&realName=<姓名>（urlencode）
 * Header: Authorization: APPCODE <appCode>
 * 返回 { error_code, reason, result: { isok, ... }, sn }，与腾讯云市场商品 25386 为
 * 同一数据服务商，结构完全一致：error_code=0 看 result.isok；206501=库无。
 * 网关状态码：401 AppCode 无效/未购买该商品；403 次数用完；400 参数缺失。
 * （旧商品 idcert.market.alicloudapi.com/idcard 已废弃——AppCode 与商品挂钩，
 *  只有购买页面上列出的接口才能调用。）
 * 重试策略：网络错重试 1 次；业务错（不一致）不重试。
 */
export async function aliyunMarketIdCardVerify(
  name: string,
  idCard: string,
  appCode: string
): Promise<{ ok: boolean; transactionId: string; message: string }> {
  const url = 'https://zidv2.market.alicloudapi.com/idcheck/Post'
  const body = `cardNo=${encodeURIComponent(idCard)}&realName=${encodeURIComponent(name)}`

  const call = async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `APPCODE ${appCode}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const raw = await res.text()
    // 容错：部分市场服务商返回二次序列化 JSON（响应体本身是 JSON 字符串），parse 两次
    let data:
      | {
          error_code?: number
          reason?: string
          result?: { isok?: boolean; realname?: string; idcard?: string } | null
          sn?: string
        }
      | string
      | null = null
    try {
      const first = JSON.parse(raw)
      data = typeof first === 'string' ? JSON.parse(first) : first
    } catch {
      /* 非 JSON 响应按错误处理 */
    }
    return { res, data, raw }
  }

  let out: Awaited<ReturnType<typeof call>>
  try {
    out = await call()
  } catch {
    // 网络错重试 1 次
    try {
      out = await call()
    } catch {
      throw new Error('实名核验通道网络异常，请稍后重试')
    }
  }

  const { res, data } = out
  // 网关错误：401 AppCode 无效或未购买对应商品；403 次数用完
  if (!res.ok) {
    console.error('[realname] aliyun market http error', res.status, out.raw.slice(0, 300))
    if (res.status === 401) {
      throw new Error('实名核验 AppCode 无效或未购买对应商品，请联系管理员到阿里云市场核对')
    }
    if (res.status === 403) throw new Error('实名核验服务次数用完，请联系管理员续费')
    throw new Error('实名核验通道配置异常，请联系管理员')
  }
  if (
    !data ||
    typeof data !== 'object' ||
    typeof (data as { error_code?: unknown }).error_code !== 'number'
  ) {
    console.error('[realname] aliyun market bad payload', out.raw.slice(0, 300))
    throw new Error('实名核验通道返回异常，请稍后重试')
  }

  const payload = data as {
    error_code?: number
    reason?: string
    result?: { isok?: boolean } | null
    sn?: string
  }
  const transactionId = payload.sn ? `ALIYUN${payload.sn}` : `ALIYUN${Date.now()}`
  if (payload.error_code === 0) {
    const isok = payload.result?.isok === true
    return {
      ok: isok,
      transactionId,
      message: isok ? '认证一致' : '姓名与身份证号不一致，请核对后重试',
    }
  }
  // 业务错：不重试，直接返回失败原因
  if (payload.error_code === 206501) {
    return { ok: false, transactionId, message: '身份证号查无记录，请核对后重试' }
  }
  return {
    ok: false,
    transactionId,
    message: payload.reason ? `核验未通过（${payload.reason}）` : '姓名与身份证号不一致，请核对后重试',
  }
}

/** 会员实名信息脱敏视图 */
export function realNameView(member: {
  isRealVerified: boolean
  realName?: string | null
  idCardNoEncrypted?: string | null
  realVerifiedAt?: Date | string | null
}) {
  return {
    isRealVerified: Boolean(member.isRealVerified),
    realName: member.realName || '',
    idCardMasked: member.idCardNoEncrypted ? maskIdCard(decryptIdCard(member.idCardNoEncrypted)) : '',
    realVerifiedAt: member.realVerifiedAt || null,
  }
}

/**
 * 认证通过后落库：会员档 + 该会员未支付订单的实名快照。
 * 合同渲染、订单详情均以此为准（认证姓名为准，用户手填联系人仅作联系电话）。
 */
export async function markVerified(
  memberId: number,
  name: string,
  idCard: string,
  channel: 'wechat_face' | 'manual_idcard',
  transactionId: string
) {
  const now = new Date()
  const enc = encryptIdCard(idCard)
  await prisma.member.update({
    where: { id: memberId },
    data: {
      isRealVerified: true,
      realName: name,
      idCardNoEncrypted: enc,
      realVerifiedAt: now,
    },
  })
  // 未支付订单补实名快照（已支付订单历史信息不追溯改动）
  await prisma.order.updateMany({
    where: { memberId, status: 'PENDING', deletedAt: null },
    data: { realName: name, realIdCardEnc: enc, realVerifiedAt: now },
  })
  return { realName: name, idCardMasked: maskIdCard(idCard), channel, transactionId, verifiedAt: now }
}
