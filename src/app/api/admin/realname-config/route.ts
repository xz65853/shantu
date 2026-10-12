import { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { getSettings, saveSettings } from '@/lib/settings'
import { encryptSecret } from '@/lib/wechat-settings'

export const dynamic = 'force-dynamic'

const schema = z.object({
  // tencent = 腾讯云市场二要素（tencent_huyan 为历史遗留值，保存时归一为 tencent）
  channel: z.enum(['none', 'wechat_face', 'tencent', 'tencent_huyan', 'aliyun']),
  required: z.boolean().default(true),
  tencent: z.object({
    secretId: z.string(),
    secretKey: z.string(),
    // 腾讯云市场「身份证实名认证」调用地址（商品 25386 默认值，一般无需修改）
    endpoint: z.string().default(''),
    bizToken: z.string().optional().default(''),
  }),
  aliyun: z.object({
    // 阿里云市场「身份证二要素核验」AppCode（必填，加密存储）
    appCode: z.string(),
    // 历史字段：仅透传占位，避免误清空，市场 API 不使用
    accessKeyId: z.string().optional().default(''),
    accessKeySecret: z.string().optional().default(''),
    endpoint: z.string().optional().default(''),
    productCode: z.string().optional().default(''),
  }),
  wechat: z.object({
    verifyId: z.string(),
  }),
})

const SETTING_KEYS = [
  'realname_channel',
  'realname_required',
  'realname_tencent_secret_id',
  'realname_tencent_secret_key',
  'realname_tencent_endpoint',
  'realname_tencent_biz_token',
  'realname_aliyun_appcode',
  'realname_aliyun_access_key_id',
  'realname_aliyun_access_key_secret',
  'realname_aliyun_endpoint',
  'realname_aliyun_product_code',
  'realname_wechat_verify_id',
]

/** 读取当前实名认证配置（密钥不返回明文；仅超管） */
export async function GET(req: NextRequest) {
  const { error } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const settings = await getSettings()
    // 历史遗留渠道值归一：tencent_huyan（旧慧眼占位）→ tencent（腾讯云市场二要素）
    const channel = settings.realname_channel === 'tencent_huyan'
      ? 'tencent'
      : settings.realname_channel || 'none'
    return ok({
      channel,
      required: settings.realname_required !== '0',
      tencent: {
        secretId: settings.realname_tencent_secret_id ? '********' : '',
        secretKey: settings.realname_tencent_secret_key ? '********' : '',
        endpoint: settings.realname_tencent_endpoint || '',
        bizToken: settings.realname_tencent_biz_token || '',
      },
      aliyun: {
        appCode: settings.realname_aliyun_appcode ? '********' : '',
        accessKeyId: settings.realname_aliyun_access_key_id ? '********' : '',
        accessKeySecret: settings.realname_aliyun_access_key_secret ? '********' : '',
        endpoint: settings.realname_aliyun_endpoint || '',
        productCode: settings.realname_aliyun_product_code || '',
      },
      wechat: {
        verifyId: settings.realname_wechat_verify_id || '',
      },
    })
  })
}

/** 保存实名认证配置（密钥加密存储；仅超管） */
export async function PATCH(req: NextRequest) {
  const { error } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)

    const values: Record<string, string> = {
      // 历史遗留渠道值归一：tencent_huyan（旧慧眼占位）→ tencent（腾讯云市场二要素）
      realname_channel: body.channel === 'tencent_huyan' ? 'tencent' : body.channel,
      realname_required: body.required ? '1' : '0',
      // 腾讯云市场调用地址：留空则代码用默认值（商品 25386 北京区）
      realname_tencent_endpoint: body.tencent?.endpoint?.trim() || '',
      realname_tencent_biz_token: body.tencent?.bizToken || '',
      realname_aliyun_endpoint: body.aliyun?.endpoint || '',
      realname_aliyun_product_code: body.aliyun?.productCode || '',
      realname_wechat_verify_id: body.wechat?.verifyId || '',
    }

    // 仅在新值非占位符且非空时才更新密钥
    if (body.tencent?.secretId && !isPlaceholder(body.tencent.secretId)) {
      values.realname_tencent_secret_id = encryptSecret(body.tencent.secretId)
    }
    if (body.tencent?.secretKey && !isPlaceholder(body.tencent.secretKey)) {
      values.realname_tencent_secret_key = encryptSecret(body.tencent.secretKey)
    }
    // 阿里云 AppCode：加密存储，接口永不回传明文（红线）
    if (body.aliyun?.appCode && !isPlaceholder(body.aliyun.appCode)) {
      values.realname_aliyun_appcode = encryptSecret(body.aliyun.appCode)
    }
    if (body.aliyun?.accessKeyId && !isPlaceholder(body.aliyun.accessKeyId)) {
      values.realname_aliyun_access_key_id = encryptSecret(body.aliyun.accessKeyId)
    }
    if (body.aliyun?.accessKeySecret && !isPlaceholder(body.aliyun.accessKeySecret)) {
      values.realname_aliyun_access_key_secret = encryptSecret(body.aliyun.accessKeySecret)
    }

    await saveSettings(values)
    return ok({ saved: true })
  })
}

function isPlaceholder(v: string) {
  return v.replaceAll('*', '').length === 0
}
