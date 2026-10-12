import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { guard } from '@/lib/api'

export const dynamic = 'force-dynamic'

/** 后台广告监测统计 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const { error } = await guard('dashboard'); if (error) return error

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [todayClicks, todayLeads, todayOrders, totalClicks] = await Promise.all([
      prisma.adClick.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.adClick.count({ where: { createdAt: { gte: today, lt: tomorrow }, isConverted: true } }),
      prisma.adClick.count({ where: { createdAt: { gte: today, lt: tomorrow }, isOrdered: true } }),
      prisma.adClick.count(),
    ])

    // 近30天趋势
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const trend = await prisma.adClick.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, isConverted: true, isOrdered: true },
      orderBy: { createdAt: 'asc' },
    })

    // 按天聚合
    const daily: Record<string, { clicks: number; leads: number; orders: number }> = {}
    trend.forEach((c) => {
      const day = c.createdAt.toISOString().slice(0, 10)
      if (!daily[day]) daily[day] = { clicks: 0, leads: 0, orders: 0 }
      daily[day].clicks++
      if (c.isConverted) daily[day].leads++
      if (c.isOrdered) daily[day].orders++
    })

    const trendData = Object.entries(daily).map(([date, v]) => ({ date, ...v }))

    // 最近点击明细
    const recent = await prisma.adClick.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return ok({
      todayClicks,
      todayLeads,
      todayOrders,
      totalClicks,
      trend: trendData,
      recent,
    })
  })
}
