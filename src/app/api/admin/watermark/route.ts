import { z } from 'zod'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { getSettings, saveSettings } from '@/lib/settings'
import { logOperation, getClientIp } from '@/lib/admin-log'

export const dynamic = 'force-dynamic'

/** 水印配置 key 清单：按分类列出，便于前端渲染与保存校验 */
const WATERMARK_KEYS = [
  // 合同 PDF 水印
  'cwm_enable', 'cwm_template', 'cwm_font_size', 'cwm_color', 'cwm_opacity', 'cwm_rotate', 'cwm_gap_x', 'cwm_gap_y',
  // 小程序溯源水印（案例/日报/月报）
  'watermark_enable', 'watermark_template', 'watermark_guest_text', 'watermark_font_size', 'watermark_color', 'watermark_opacity', 'watermark_rotate', 'watermark_gap_x', 'watermark_gap_y',
  // 上传图片水印（管理后台上传案例/日报/月报图片时烧录）
  'upload_wm_enable', 'upload_wm_text', 'upload_wm_color', 'upload_wm_opacity', 'upload_wm_font_size', 'upload_wm_rotate', 'upload_wm_gap_x', 'upload_wm_gap_y',
  // 文章水印
  'article_wm_enable', 'article_wm_text',
  // 素材库水印
  'media_wm_enable', 'media_wm_template',
  // 订单水印
  'order_wm_enable',
  // 实名身份证水印
  'realname_wm_enable', 'realname_wm_text',
]

/** 读取全部水印配置 */
export async function GET() {
  const { error } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const all = await getSettings()
    const out: Record<string, string> = {}
    for (const k of WATERMARK_KEYS) out[k] = all[k] ?? ''
    return ok(out)
  })
}

const saveSchema = z.record(z.string(), z.string().max(2000))

/** 保存水印配置：只接受白名单 key，写操作日志（谁改的、改了啥） */
export async function PUT(req: Request) {
  const { error, admin } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, saveSchema)

    // 只允许白名单 key，防止任意 key 被写入
    const allowed: Record<string, string> = {}
    for (const [k, v] of Object.entries(body)) {
      if (WATERMARK_KEYS.includes(k)) allowed[k] = v
    }

    const before = await getSettings()
    const beforeSnapshot: Record<string, string> = {}
    for (const k of Object.keys(allowed)) beforeSnapshot[k] = before[k] ?? ''

    await saveSettings(allowed)

    await logOperation({
      adminId: admin?.id ?? null,
      username: admin?.username ?? admin?.name ?? null,
      module: '水印设置',
      action: 'update',
      targetType: 'watermark',
      before: beforeSnapshot,
      after: allowed,
      ip: getClientIp(req),
    })

    return ok(null, '水印设置已保存，立即生效')
  })
}
