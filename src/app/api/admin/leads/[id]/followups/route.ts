import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { followupSchema } from '@/lib/validators'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { admin, error } = await guard('leads')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, followupSchema)
    const leadId = Number(id)
    if (!Number.isFinite(leadId)) return fail('参数错误')

    const item = await prisma.leadFollowup.create({
      data: {
        leadId,
        adminId: admin!.id,
        content: body.content,
        nextFollowupAt: body.nextFollowupAt ? new Date(body.nextFollowupAt) : null,
      },
    })

    await prisma.lead.update({
      where: { id: leadId },
      data: { updatedAt: new Date() },
    })

    return ok({ id: item.id }, '已添加跟进记录')
  })
}
