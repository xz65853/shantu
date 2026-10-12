import { guard, handle, ok, fail, parseBody } from '@/lib/api'
import { orderUpdateSchema } from '@/lib/validators'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: Request, ctx: Ctx) {
  const { error } = await guard('orders')
  if (error) return error

  const { id } = await ctx.params
  return handle(async () => {
    const body = await parseBody(req, orderUpdateSchema)
    const target = await prisma.order.findUnique({ where: { id: Number(id) } })
    if (!target) return fail('订单不存在', 404)

    const data: Record<string, unknown> = {}
    if (body.status) data.status = body.status
    if (body.payMethod !== undefined) data.payMethod = body.payMethod
    if (body.transactionId !== undefined) data.transactionId = body.transactionId || null
    if (body.adminRemark !== undefined) data.adminRemark = body.adminRemark || null

    // 标记为已支付时自动记录支付时间
    if (body.status === 'PAID' && !target.paidAt) data.paidAt = new Date()
    if (body.status && body.status !== 'PAID') data.paidAt = null

    const updated = await prisma.order.update({ where: { id: Number(id) }, data })

    // 后台人工置为已支付时，触发与支付回调一致的后付费钩子（合同/项目/机器人推送），幂等
    if (body.status === 'PAID' && target.status !== 'PAID') {
      try {
        const { handleOrderPaid } = await import('@/lib/order/OrderPostPaidService')
        await handleOrderPaid(updated.id)
      } catch (e) {
        console.error('[admin order] handleOrderPaid failed', e)
      }
    }

    return ok(updated, '订单已更新')
  })
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await guard('orders')
  if (error) return error

  const { id } = await ctx.params
  return handle(async () => {
    const order = await prisma.order.findUnique({ where: { id: Number(id) } })
    if (!order) return fail('订单不存在', 404)
    if (order.status === 'PAID') return fail('已支付订单不能删除，请先退款', 400)
    await prisma.order.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), deleteReason: '后台删除' } })
    return ok(null, '订单已移入回收站')
  })
}
