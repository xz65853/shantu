import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { getClientIp, logOperation } from '@/lib/admin-log'

const schema = z.object({ type: z.enum(['order', 'member', 'lead', 'contract']), id: z.coerce.number().int().positive() })

/** 彻底删除：真删数据库行（仅超管，前端已二次确认+输对象名） */
export async function POST(req: NextRequest) {
  const { admin, error } = await guard('recycle')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)
    const ip = getClientIp(req)
    const ua = req.headers.get('user-agent') || ''

    try {
      if (body.type === 'order') {
        const order = await prisma.order.findUnique({ where: { id: body.id } })
        if (!order || !order.deletedAt) return fail('该记录不在回收站', 404)
        await prisma.order.delete({ where: { id: body.id } })
        await logOperation({ adminId: admin.id, username: admin.username, module: '订单', action: 'purge', targetType: 'order', targetId: body.id, before: { orderNo: order.orderNo, name: order.name, phone: order.phone }, ip, ua })
      } else if (body.type === 'member') {
        const member = await prisma.member.findUnique({ where: { id: body.id } })
        if (!member || !member.deletedAt) return fail('该记录不在回收站', 404)
        await prisma.member.delete({ where: { id: body.id } })
        await logOperation({ adminId: admin.id, username: admin.username, module: '会员', action: 'purge', targetType: 'member', targetId: body.id, before: { userId: member.userId, phone: member.phone }, ip, ua })
      } else if (body.type === 'lead') {
        const lead = await prisma.lead.findUnique({ where: { id: body.id } })
        if (!lead || !lead.deletedAt) return fail('该记录不在回收站', 404)
        await prisma.lead.delete({ where: { id: body.id } })
        await logOperation({ adminId: admin.id, username: admin.username, module: '线索', action: 'purge', targetType: 'lead', targetId: body.id, before: { name: lead.name, phone: lead.phone }, ip, ua })
      } else if (body.type === 'contract') {
        const contract = await prisma.contract.findUnique({ where: { id: body.id } })
        if (!contract || !contract.deletedAt) return fail('该记录不在回收站', 404)
        await prisma.contract.delete({ where: { id: body.id } })
        await logOperation({ adminId: admin.id, username: admin.username, module: '合同', action: 'purge', targetType: 'contract', targetId: body.id, before: { contractNo: contract.contractNo, partyAName: contract.partyAName }, ip, ua })
      } else {
        return fail('未知类型', 400)
      }
      return ok(null, '已彻底删除')
    } catch (e) {
      console.error('[purge]', e instanceof Error ? e.stack : String(e))
      return fail('彻底删除失败（可能存在关联数据，请先处理关联记录）', 400)
    }
  })
}
