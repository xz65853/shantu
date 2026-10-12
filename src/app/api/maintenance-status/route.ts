import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/**
 * 网站维护状态查询（匿名 GET，供中间件读取）
 * 只暴露维护开关、公开文案与小程序码，无任何敏感信息。
 */
export async function GET(_req: NextRequest) {
  return handle(async () => {
    const s = await getSettings()
    return ok({
      enabled: s.maintenance_enable === '1',
      reason: s.maintenance_reason || '网站升级维护中，预计 24 小时内恢复',
      resumeAt: s.maintenance_resume_at || '',
      qrcode: s.wechat_qrcode || '',
    })
  })
}
