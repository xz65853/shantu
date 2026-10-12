import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'

/** 当前会员的订单列表（小程序「我的-我的订单」用，Bearer 鉴权） */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return { list: [] }

    const list = await prisma.order.findMany({
      where: { memberId: payload.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        orderNo: true,
        packageName: true,
        period: true,
        amount: true,
        status: true,
        payMethod: true,
        createdAt: true,
      },
    })
    return { list }
  })
}
