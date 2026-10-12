import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  packageName: z.string().trim().max(60).optional().nullable(),
  serviceDesc: z.string().trim().max(2000).optional().nullable(),
  manager: z.string().trim().max(20).optional().nullable(),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'RUNNING', 'PAUSED', 'DONE']).optional(),
  note: z.string().trim().max(2000).optional().nullable(),
})

function parseImages(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** 项目详情（含报告） */
export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        member: { select: { id: true, userId: true, name: true, nickname: true, phone: true } },
        reports: { orderBy: { month: 'desc' } },
        dailyLogs: { orderBy: { workDate: 'desc' } },
        serviceType: true,
      },
    })
    if (!project) return fail('项目不存在', 404)
    const { reports, dailyLogs, ...rest } = project
    return ok({
      ...rest,
      reports: reports.map((r) => ({ ...r, images: parseImages(r.imagesJson) })),
      dailyLogs: dailyLogs.map((d) => ({
        id: d.id,
        workDate: d.workDate,
        content: d.content,
        videos: d.videos,
        lives: d.lives,
        views: Number(d.views),
        newFans: d.newFans,
        leads: d.leads,
        deals: d.deals,
        gmv: Number(d.gmv),
        summary: d.summary || '',
        images: parseImages(d.imagesJson),
        createdAt: d.createdAt,
      })),
    })
  })
}

/** 更新项目 */
export async function PUT(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const body = await parseBody(req, updateSchema)
    const project = await prisma.project.update({
      where: { id: Number(id) },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.packageName !== undefined ? { packageName: body.packageName || null } : {}),
        ...(body.serviceDesc !== undefined ? { serviceDesc: body.serviceDesc || null } : {}),
        ...(body.manager !== undefined ? { manager: body.manager || null } : {}),
        ...(body.startAt !== undefined ? { startAt: body.startAt ? new Date(body.startAt) : null } : {}),
        ...(body.endAt !== undefined ? { endAt: body.endAt ? new Date(body.endAt) : null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.note !== undefined ? { note: body.note || null } : {}),
      },
    })
    return ok(project, '项目已更新')
  })
}

/** 删除项目（连带删除报告、日报） */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    await prisma.project.delete({ where: { id: Number(id) } })
    return ok(null, '项目已删除')
  })
}
