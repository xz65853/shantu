import { headers, cookies } from 'next/headers'
import { prisma } from './db'
import { verifyMemberToken, MEMBER_COOKIE } from './member-auth'

export async function recordVisit() {
  try {
    const h = await headers()
    const path = h.get('x-pathname') || h.get('referer') || '/'

    // 解析登录会员（已登录则关联 member_id，未登录为 null）
    let memberId: number | null = null
    try {
      const store = await cookies()
      const token = store.get(MEMBER_COOKIE)?.value
      if (token) {
        const payload = await verifyMemberToken(token)
        if (payload) memberId = payload.id
      }
    } catch {
      // cookie 解析失败不影响访问记录
    }

    await prisma.visitLog.create({
      data: {
        path: path.slice(0, 255),
        referer: h.get('referer') || null,
        ua: (h.get('user-agent') || '').slice(0, 255) || null,
        ip:
          (h.get('x-forwarded-for') || '').split(',')[0]?.trim().slice(0, 45) ||
          h.get('x-real-ip') ||
          null,
        memberId,
      },
    })
  } catch {
    // 统计失败不影响页面渲染
  }
}
