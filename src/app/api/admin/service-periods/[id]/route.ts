import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  packageName: z.string().trim().max(60).optional().nullable(),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
})

/** 更新服务周期（状态/起止时间） */
export async function PUT(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const body = await parseBody(req, updateSchema)
    const period = await prisma.servicePeriod.update({
      where: { id: Number(id) },
      data: {
        ...(body.packageName !== undefined ? { packageName: body.packageName || null } : {}),
        ...(body.startAt ? { startAt: new Date(body.startAt) } : {}),
        ...(body.endAt ? { endAt: new Date(body.endAt) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    })
    return ok(period, '服务周期已更新')
  })
}

/** 删除服务周期（连带删除其下任务） */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    await prisma.servicePeriod.delete({ where: { id: Number(id) } })
    return ok(null, '服务周期已删除')
  })
}
