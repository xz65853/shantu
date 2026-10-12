import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

// 数字字段改为可选：提交时后端自动从当月日报汇总，忽略前端手填值
const reportSchema = z.object({
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
  images: z.array(z.string().trim().max(500)).max(9).optional().default([]), // 运营截图 URL 数组
})

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

/** 创建/更新某项目的月度运营报告（数字字段自动汇总当月日报，同月重复提交覆盖更新） */
export async function POST(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const projectId = Number(id)
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { serviceType: true } })
    if (!project) return fail('项目不存在', 404)

    const body = await parseBody(req, reportSchema)

    // 自动汇总当月日报数据（改任意一天日报后，月报数字自动重算）
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

    // 按服务类型 reportConfig 汇总动态字段
    let dynData: Record<string, number | string> = {}
    if (project.serviceType) {
      let fields: { name: string; type: string }[] = []
      let rules: Record<string, string> = {}
      try { fields = JSON.parse(project.serviceType.fieldsConfig || '[]') } catch {}
      try { rules = JSON.parse(project.serviceType.reportConfig || '{}') } catch {}
      const values: Record<string, number[]> = {}
      logs.forEach((l) => {
        let row: Record<string, string> = {}
        try { row = l.dataJson ? JSON.parse(l.dataJson) : {} } catch {}
        fields.forEach((f) => {
          if (f.type === 'number' || f.type === 'percent') {
            const n = Number(row[f.name])
            if (Number.isFinite(n)) {
              values[f.name] = values[f.name] || []
              values[f.name].push(n)
            }
          }
        })
      })
      Object.entries(values).forEach(([name, nums]) => {
        const rule = rules[name] || 'sum'
        if (rule === 'sum') dynData[name] = nums.reduce((a, b) => a + b, 0)
        else if (rule === 'avg') dynData[name] = Math.round(nums.reduce((a, b) => a + b, 0) / (nums.length || 1))
        else if (rule === 'latest') dynData[name] = nums[nums.length - 1] || 0
      })
    }

    const imagesJson = JSON.stringify(body.images)
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
      imagesJson,
      dataJson: JSON.stringify(dynData),
    }
    const report = await prisma.projectReport.upsert({
      where: { projectId_month: { projectId, month: body.month } },
      create: { projectId, month: body.month, ...data },
      update: data,
    })
    return ok({ ...report, aggregated: agg, dailyCount: logs.length, dynData }, '运营报告已保存')
  })
}

/** 删除报告 ?reportId= */
export async function DELETE(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  await ctx.params
  return handle(async () => {
    const reportId = Number(new URL(req.url).searchParams.get('reportId') || 0)
    if (!reportId) return fail('参数错误', 400)
    await prisma.projectReport.delete({ where: { id: reportId } })
    return ok(null, '报告已删除')
  })
}
