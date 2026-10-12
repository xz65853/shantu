import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

const taskSchema = z.object({
  title: z.string().trim().min(1, '请填写任务标题').max(200),
  description: z.string().trim().max(2000).optional().default(''),
  assigneeId: z.number().int().positive().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  sort: z.number().int().min(0).optional().default(0),
})

/** 任务列表（按 sort + id 升序） */
export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const periodId = Number(id)
    const period = await prisma.servicePeriod.findUnique({ where: { id: periodId } })
    if (!period) return fail('服务周期不存在', 404)
    const tasks = await prisma.task.findMany({
      where: { periodId },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
    return ok({ tasks })
  })
}

/** 创建任务 */
export async function POST(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const periodId = Number(id)
    const period = await prisma.servicePeriod.findUnique({ where: { id: periodId } })
    if (!period) return fail('服务周期不存在', 404)
    const body = await parseBody(req, taskSchema)
    const task = await prisma.task.create({
      data: {
        periodId,
        title: body.title,
        description: body.description || null,
        assigneeId: body.assigneeId || null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        sort: body.sort,
      },
    })
    return ok(task, '任务已创建')
  })
}
