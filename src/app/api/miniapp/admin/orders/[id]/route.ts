import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { canMiniWrite, getMiniAdmin, writeMiniAdminLog } from '@/lib/mini-admin-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ORDER_STATUS = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const

const schema = z.object({
  status: z.enum(ORDER_STATUS).optional(),
  // 金额：单位分；改金额仅超管/财务
  amount: z.number().int().min(0).optional(),
})

type Ctx = { params: Promise<{ id: string }> }

/** 改订单状态 / 金额（改金额需二次确认由前端做，此处校验角色） */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  if (!canMiniWrite(admin.role)) return fail('该角色无操作权限', 403, 403)

  const { id } = await params
  return handle(async () => {
    const body = await parseBody(req, schema)
    if (body.amount !== undefined && !canMiniWrite(admin.role, 'amount')) {
      return fail('仅超管或财务可修改金额', 403, 403)
    }

    const orderId = Number(id)
    if (!Number.isFinite(orderId)) return fail('参数错误')

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return fail('订单不存在', 404)

    const data: Record<string, unknown> = {}
    if (body.status) data.status = body.status
    if (body.amount !== undefined) data.amount = body.amount
    // 标记已支付自动补支付时间
    if (body.status === 'PAID' && !order.paidAt) data.paidAt = new Date()
    if (body.status && body.status !== 'PAID') data.paidAt = null

    const before = { status: order.status, amount: order.amount }
    await prisma.order.update({ where: { id: orderId }, data })
    await writeMiniAdminLog(admin, req, '订单', 'update', 'order', orderId)

    return ok({ id: orderId, before }, '订单已更新')
  })
}
