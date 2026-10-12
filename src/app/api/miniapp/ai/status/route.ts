import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { countAiCallsToday, getAiDailyLimit, hasPaidOrder } from '@/lib/ai'

export const dynamic = 'force-dynamic'

/** 查询当前会员的 AI 权限：是否有已支付订单 + 当日剩余次数 */
export async function GET(req: Request) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const paid = await hasPaidOrder(payload.id)
    const limit = await getAiDailyLimit()
    const used = await countAiCallsToday(payload.id)

    // 后台开关：关闭时所有用户不可用
    const switchRow = await prisma.siteSetting.findUnique({ where: { key: 'mini_ai_enabled' } })
    const aiEnabled = switchRow?.value !== '0'

    return ok({
      canUseAi: aiEnabled && paid,
      aiEnabled,
      dailyLimit: limit,
      usedToday: used,
      remaining: Math.max(0, limit - used),
    })
  })
}