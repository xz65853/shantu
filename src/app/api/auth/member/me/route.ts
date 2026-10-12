import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'

/** 当前登录会员（官网 Cookie / 小程序 Bearer 均可） */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return null
    const member = await prisma.member.findFirst({
      where: { id: payload.id, status: 'ACTIVE' },
      include: { _count: { select: { orders: true } } },
    })
    if (!member) return null
    return {
      id: member.id,
      userId: member.userId,
      type: member.type,
      phone: member.phone,
      name: member.name,
      nickname: member.nickname,
      avatar: member.avatar,
      hasPassword: Boolean(member.passwordHash),
      orderCount: member._count.orders,
    }
  })
}
