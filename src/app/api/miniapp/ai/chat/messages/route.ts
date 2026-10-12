import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { loadChatHistory } from '@/lib/ai'

export const dynamic = 'force-dynamic'

/** 加载当前会员的聊天记录（最近 50 条，按时间升序） */
export async function GET(req: Request) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const list = await loadChatHistory(payload.id, 50)
    return ok({ list })
  })
}