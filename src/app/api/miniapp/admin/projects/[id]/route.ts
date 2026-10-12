import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'
import { fullUrl } from '@/lib/full-url'

export const dynamic = 'force-dynamic'

function parseImages(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** 项目详情（手机端）：项目基本信息 + 月报列表 + 日报（按时间倒序） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getMiniAdmin(_req)
  if (!admin) return fail('您没有权限访问', 403, 403)

  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return fail('参数错误', 400)

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      packageName: true,
      serviceDesc: true,
      manager: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  })
  if (!project) return fail('项目不存在', 404)

  const [reports, dailyLogs] = await Promise.all([
    prisma.projectReport.findMany({
      where: { projectId },
      orderBy: { month: 'desc' },
      select: {
        id: true,
        month: true,
        videos: true,
        lives: true,
        views: true,
        newFans: true,
        leads: true,
        deals: true,
        gmv: true,
        summary: true,
        nextPlan: true,
        imagesJson: true,
      },
    }),
    prisma.projectDailyLog.findMany({
      where: { projectId },
      orderBy: { workDate: 'desc' },
      select: {
        id: true,
        workDate: true,
        content: true,
        videos: true,
        lives: true,
        views: true,
        newFans: true,
        leads: true,
        deals: true,
        gmv: true,
        summary: true,
        imagesJson: true,
      },
    }),
  ])

  return ok({
    project,
    // 相对路径必须转绝对地址，否则手机端 <image> 无法加载
    reports: reports.map((r) => ({
      ...r,
      images: parseImages(r.imagesJson).map(fullUrl),
    })),
    dailyLogs: dailyLogs.map((d) => ({
      ...d,
      views: Number(d.views),
      gmv: Number(d.gmv),
      images: parseImages(d.imagesJson).map(fullUrl),
    })),
  })
}
