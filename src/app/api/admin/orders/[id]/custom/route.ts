import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, fail, parseBody } from '@/lib/api'

const schema = z.object({
  serviceContent: z.string().trim().min(1, '请填写服务内容').max(10000).optional(),
  amount: z.coerce.number().int().min(0, '金额不能为负').optional(),
  periodStart: z.string().max(40).optional().nullable(),
  periodEnd: z.string().max(40).optional().nullable(),
  note: z.string().trim().max(2000).optional().default(''),
})

/** 顾问改单：编辑定制单内容/金额/周期，留操作日志，状态转待用户确认 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error } = await guard('orders')
  if (error) return error
  return handle(async () => {
    const { id } = await params
    const oid = Number(id)
    const order = await prisma.order.findFirst({ where: { id: oid, deletedAt: null } })
    if (!order) return fail('订单不存在', 404)
    if (order.type !== 'CUSTOM') return fail('该订单不是定制单', 400)

    const body = await parseBody(req, schema)
    const before = {
      serviceContent: order.serviceContent,
      amount: order.amount,
      periodStart: null,
      periodEnd: null,
    }

    const data: Record<string, unknown> = { customStatus: 'PENDING_CONFIRM' }
    if (body.serviceContent !== undefined) data.serviceContent = body.serviceContent
    if (body.amount !== undefined) data.amount = body.amount
    if (body.note) data.adminRemark = body.note

    const updated = await prisma.order.update({ where: { id: oid }, data })

    await prisma.orderChangeLog.create({
      data: {
        orderId: oid,
        adminId: admin.id,
        adminName: admin.name,
        changes: JSON.stringify({ before, after: { serviceContent: updated.serviceContent, amount: updated.amount } }),
      },
    })

    return ok({ id: updated.id, customStatus: updated.customStatus, amount: updated.amount })
  })
}
