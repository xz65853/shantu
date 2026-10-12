import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  assigneeId: z.number().int().positive().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED']).optional(),
  sort: z.number().int().min(0).optional(),
})

/** 更新任务（状态流转：完成自动记 completedAt） */
export async function PUT(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const body = await parseBody(req, updateSchema)
    const task = await prisma.task.update({
      where: { id: Number(id) },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId || null } : {}),
        ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.sort !== undefined ? { sort: body.sort } : {}),
        ...(body.status === 'COMPLETED' ? { completedAt: new Date() } : body.status ? { completedAt: null } : {}),
      },
    })
    return ok(task, '任务已更新')
  })
}

/** 删除任务 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    await prisma.task.delete({ where: { id: Number(id) } })
    return ok(null, '任务已删除')
  })
}
