import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { clearChatHistory } from '@/lib/ai'

export const dynamic = 'force-dynamic'

/** 清空当前会员的全部聊天记录 */
export async function POST(req: Request) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const done = await clearChatHistory(payload.id)
    return ok({ cleared: done })
  })
}