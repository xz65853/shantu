import { guard, handle, ok, parseBody } from '@/lib/api'
import { settingsSchema } from '@/lib/validators'
import {
  WECHAT_KEYS,
  WECHAT_SECRET_KEYS,
  getWechatSettings,
  getWechatSettingsMasked,
  saveWechatSettings,
} from '@/lib/wechat-settings'

/** 后台读取：敏感字段返回掩码 */
export async function GET() {
  const { error } = await guard('wechat')
  if (error) return error

  return handle(async () => {
    const masked = await getWechatSettingsMasked()
    const raw = await getWechatSettings()
    const configured: Record<string, boolean> = {}
    for (const key of WECHAT_SECRET_KEYS) configured[key] = Boolean(raw[key])
    return ok({ settings: masked, configured })
  })
}

/** 后台保存：只处理白名单 key；敏感字段为空或掩码时保持不变 */
export async function POST(req: Request) {
  const { error } = await guard('wechat')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, settingsSchema)
    const payload: Record<string, string> = {}
    for (const [key, value] of Object.entries(body)) {
      if (WECHAT_KEYS.includes(key)) payload[key] = value
    }
    if (Object.keys(payload).length === 0) return ok(null, '没有需要保存的配置')
    await saveWechatSettings(payload)
    return ok(null, '小程序设置已保存')
  })
}
