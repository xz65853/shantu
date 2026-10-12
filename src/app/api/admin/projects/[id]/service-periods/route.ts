import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

const periodSchema = z.object({
  packageName: z.string().trim().max(60).optional().default(''),
  periodDays: z.number().int().min(1).max(3650).default(31),
  startAt: z.string().min(1, '请选择开始日期'),
  endAt: z.string().min(1, '请选择结束日期'),
  orderId: z.number().int().positive().optional().nullable(),
})

/** 服务周期列表（按开始日期倒序） */
export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const projectId = Number(id)
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)
    const periods = await prisma.servicePeriod.findMany({
      where: { projectId },
      orderBy: { startAt: 'desc' },
      include: { _count: { select: { tasks: true } } },
    })
    return ok({ periods })
  })
}

/** 创建服务周期（续费：自动接续上一周期） */
export async function POST(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const projectId = Number(id)
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)
    const body = await parseBody(req, periodSchema)

    // 续费链：找到项目最后一个周期作为 prevPeriodId
    const lastPeriod = await prisma.servicePeriod.findFirst({
      where: { projectId },
      orderBy: { endAt: 'desc' },
    })

    const period = await prisma.servicePeriod.create({
      data: {
        projectId,
        orderId: body.orderId || null,
        packageName: body.packageName || null,
        periodDays: body.periodDays,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        status: 'PENDING',
        prevPeriodId: lastPeriod?.id || null,
      },
    })
    return ok(period, '服务周期已创建')
  })
}
