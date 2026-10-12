import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { getClientIp, logOperation } from '@/lib/admin-log'

const schema = z.object({ type: z.enum(['order', 'member', 'lead', 'contract']), id: z.coerce.number().int().positive() })

/** 恢复：deleted_at 置回 NULL，记日志（已注销会员不可恢复，仅订单/线索/合同可恢复） */
export async function POST(req: NextRequest) {
  const { admin, error } = await guard('recycle')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)
    const ip = getClientIp(req)
    const ua = req.headers.get('user-agent') || ''

    if (body.type === 'order') {
      const order = await prisma.order.findUnique({ where: { id: body.id } })
      if (!order || !order.deletedAt) return fail('该记录不在回收站', 404)
      await prisma.order.update({ where: { id: body.id }, data: { deletedAt: null, deletedBy: null, deleteReason: null } })
      await logOperation({ adminId: admin.id, username: admin.username, module: '订单', action: 'restore', targetType: 'order', targetId: body.id, before: { orderNo: order.orderNo }, after: { restored: true }, ip, ua })
      return ok(null, '订单已恢复')
    }

    if (body.type === 'lead') {
      const lead = await prisma.lead.findUnique({ where: { id: body.id } })
      if (!lead || !lead.deletedAt) return fail('该记录不在回收站', 404)
      await prisma.lead.update({ where: { id: body.id }, data: { deletedAt: null, deletedBy: null, deleteReason: null } })
      await logOperation({ adminId: admin.id, username: admin.username, module: '线索', action: 'restore', targetType: 'lead', targetId: body.id, before: { name: lead.name }, after: { restored: true }, ip, ua })
      return ok(null, '线索已恢复')
    }

    if (body.type === 'contract') {
      const contract = await prisma.contract.findUnique({ where: { id: body.id } })
      if (!contract || !contract.deletedAt) return fail('该记录不在回收站', 404)
      await prisma.contract.update({ where: { id: body.id }, data: { deletedAt: null, deletedBy: null, deleteReason: null } })
      await logOperation({ adminId: admin.id, username: admin.username, module: '合同', action: 'restore', targetType: 'contract', targetId: body.id, before: { contractNo: contract.contractNo }, after: { restored: true }, ip, ua })
      return ok(null, '合同已恢复')
    }

    if (body.type === 'member') {
      const member = await prisma.member.findUnique({ where: { id: body.id } })
      if (!member || !member.deletedAt) return fail('该记录不在回收站', 404)
      return fail('已注销会员不可恢复（如需重新使用请重新注册）', 400)
    }

    return fail('未知类型', 400)
  })
}
