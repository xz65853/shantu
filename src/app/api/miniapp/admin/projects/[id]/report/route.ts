import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { canMiniWrite, getMiniAdmin, writeMiniAdminLog } from '@/lib/mini-admin-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// 数字字段可选：后端自动从当月日报汇总
const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '月份格式应为 YYYY-MM'),
  videos: z.number().int().min(0).optional(),
  lives: z.number().int().min(0).optional(),
  views: z.number().int().min(0).optional(),
  newFans: z.number().int().min(0).optional(),
  leads: z.number().int().min(0).optional(),
  deals: z.number().int().min(0).optional(),
  gmv: z.number().int().min(0).optional(),
  summary: z.string().trim().max(5000).optional().default(''),
  nextPlan: z.string().trim().max(5000).optional().default(''),
})

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

type Ctx = { params: Promise<{ id: string }> }

/** 填项目月报（数字字段自动汇总当月日报，同日 upsert） */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  if (!canMiniWrite(admin.role, 'daily')) return fail('该角色无操作权限', 403, 403)

  const { id } = await params
  return handle(async () => {
    const body = await parseBody(req, schema)
    const projectId = Number(id)
    if (!Number.isFinite(projectId)) return fail('参数错误')

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)

    const logs = await prisma.projectDailyLog.findMany({
      where: { projectId, workDate: { startsWith: body.month } },
    })
    const agg = {
      videos: logs.reduce((s, l) => s + num(l.videos), 0),
      lives: logs.reduce((s, l) => s + num(l.lives), 0),
      views: logs.reduce((s, l) => s + num(l.views), 0),
      newFans: logs.reduce((s, l) => s + num(l.newFans), 0),
      leads: logs.reduce((s, l) => s + num(l.leads), 0),
      deals: logs.reduce((s, l) => s + num(l.deals), 0),
      gmv: logs.reduce((s, l) => s + num(l.gmv), 0),
    }

    const data = {
      videos: agg.videos,
      lives: agg.lives,
      views: agg.views,
      newFans: agg.newFans,
      leads: agg.leads,
      deals: agg.deals,
      gmv: agg.gmv,
      summary: body.summary,
      nextPlan: body.nextPlan,
    }
    await prisma.projectReport.upsert({
      where: { projectId_month: { projectId, month: body.month } },
      create: { projectId, month: body.month, ...data },
      update: data,
    })
    await writeMiniAdminLog(admin, req, '项目', 'report', 'project', projectId)

    return ok({ aggregated: agg, dailyCount: logs.length }, '月报已保存')
  })
}
