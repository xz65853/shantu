import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'

export const dynamic = 'force-dynamic'

/** 我的项目列表（Bearer 鉴权，只返回当前会员的项目） */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const list = await prisma.project.findMany({
      where: { memberId: payload.id },
      orderBy: { createdAt: 'desc' },
      include: {
        reports: {
          orderBy: { month: 'desc' },
          take: 1,
          select: { month: true },
        },
      },
    })

    return ok({
      list: list.map((p) => ({
        id: p.id,
        projectNo: p.projectNo || 'XM' + String(p.id).padStart(6, '0'),
        name: p.name,
        packageName: p.packageName,
        manager: p.manager,
        status: p.status,
        startAt: p.startAt,
        endAt: p.endAt,
        latestReportMonth: p.reports[0]?.month || null,
      })),
    })
  })
}
