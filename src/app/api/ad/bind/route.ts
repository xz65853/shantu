import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'

export const dynamic = 'force-dynamic'

/**
 * 小程序启动时把 clickid 与当前会员的 openid 绑定。
 *
 * 调用时机：小程序 app.js 拿到启动参数中的 clickid 后调一次。
 * body: { clickid: string }
 *
 * 注意：会员身份取自 token，openid 从 members 表查（token 里不含 openid）。
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const body = await req.json().catch(() => ({}) as { clickid?: string })
    const clickid = (body.clickid || '').trim()
    if (!clickid) return fail('缺少 clickid', 400, 400)
    if (clickid.length > 100) return fail('clickid 过长', 400, 400)

    // 取该会员的 openid/unionid（token 里没有这两个字段）
    const member = await prisma.member.findUnique({
      where: { id: payload.id },
      select: { openId: true, unionId: true },
    })
    if (!member) return fail('会员不存在', 404)

    const updated = await prisma.adClick.updateMany({
      where: { clickid },
      data: {
        openid: member.openId || null,
        unionid: member.unionId || null,
      },
    })

    return ok({ bound: updated.count > 0 })
  })
}
