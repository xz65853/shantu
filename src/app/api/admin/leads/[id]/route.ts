import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { leadUpdateSchema } from '@/lib/validators'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { admin, error } = await guard('leads')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, leadUpdateSchema)
    const leadId = Number(id)
    if (!Number.isFinite(leadId)) return fail('参数错误')

    const data: Record<string, unknown> = {}
    if (body.status) data.status = body.status
    if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo
    if (body.note !== undefined) data.note = body.note

    const lead = await prisma.lead.update({ where: { id: leadId }, data })
    return ok({ id: lead.id }, '已更新')
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { admin, error } = await guard('leads')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const leadId = Number(id)
    if (!Number.isFinite(leadId)) return fail('参数错误')
    await prisma.leadFollowup.deleteMany({ where: { leadId } })
    await prisma.lead.delete({ where: { id: leadId } })
    return ok(null, '已删除')
  })
}
