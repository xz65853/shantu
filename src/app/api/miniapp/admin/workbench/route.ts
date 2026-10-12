import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'

export const dynamic = 'force-dynamic'

/** 工作台聚合：今日线索 / 待跟进 / 待支付订单 / 今日成交金额 + 最近 5 条线索 / 5 笔订单 */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date()
  dayEnd.setHours(23, 59, 59, 999)

  const [todayLeads, pendingFollowup, pendingOrders, paidToday, recentLeads, recentOrders] =
    await Promise.all([
      prisma.lead.count({ where: { createdAt: { gte: dayStart, lte: dayEnd }, deletedAt: null } }),
      prisma.lead.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.order.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.order.aggregate({
        where: { status: 'PAID', paidAt: { gte: dayStart, lte: dayEnd }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.lead.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, phone: true, industry: true, status: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNo: true, packageName: true, amount: true, name: true, status: true, createdAt: true },
      }),
    ])

  return ok({
    todayLeads,
    pendingFollowup,
    pendingOrders,
    todayAmount: paidToday._sum.amount || 0,
    recentLeads,
    recentOrders,
  })
}
