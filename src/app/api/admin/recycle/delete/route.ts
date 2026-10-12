import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { getClientIp, logOperation } from '@/lib/admin-log'

const schema = z.object({
  type: z.enum(['order', 'member', 'lead', 'contract']),
  id: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1, '请选择删除原因').max(255),
})

/** 软删除：订单/会员/线索/合同（仅超管），deleted_at 置位，记操作日志 */
export async function POST(req: NextRequest) {
  const { admin, error } = await guard('recycle')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)
    const ip = getClientIp(req)
    const ua = req.headers.get('user-agent') || ''
    const now = new Date()

    if (body.type === 'order') {
      const order = await prisma.order.findUnique({ where: { id: body.id } })
      if (!order || order.deletedAt) return fail('订单不存在或已在回收站', 404)
      if (order.status === 'PAID') return fail('已支付订单不能删除，请先退款', 400)
      await prisma.order.update({ where: { id: body.id }, data: { deletedAt: now, deletedBy: admin.id, deleteReason: body.reason } })
      await logOperation({ adminId: admin.id, username: admin.username, module: '订单', action: 'delete', targetType: 'order', targetId: body.id, before: { orderNo: order.orderNo, name: order.name, phone: order.phone, amount: order.amount, status: order.status }, after: { deleteReason: body.reason }, ip, ua })
      return ok(null, '订单已移入回收站')
    }

    if (body.type === 'lead') {
      const lead = await prisma.lead.findUnique({ where: { id: body.id } })
      if (!lead || lead.deletedAt) return fail('线索不存在或已在回收站', 404)
      await prisma.lead.update({ where: { id: body.id }, data: { deletedAt: now, deletedBy: admin.id, deleteReason: body.reason } })
      await logOperation({ adminId: admin.id, username: admin.username, module: '线索', action: 'delete', targetType: 'lead', targetId: body.id, before: { name: lead.name, phone: lead.phone, source: lead.source }, after: { deleteReason: body.reason }, ip, ua })
      return ok(null, '线索已移入回收站')
    }

    if (body.type === 'contract') {
      const contract = await prisma.contract.findUnique({ where: { id: body.id } })
      if (!contract || contract.deletedAt) return fail('合同不存在或已在回收站', 404)
      if (contract.status === 'SIGNED') return fail('已签合同不能删除', 400)
      await prisma.contract.update({ where: { id: body.id }, data: { deletedAt: now, deletedBy: admin.id, deleteReason: body.reason } })
      await logOperation({ adminId: admin.id, username: admin.username, module: '合同', action: 'delete', targetType: 'contract', targetId: body.id, before: { contractNo: contract.contractNo, partyAName: contract.partyAName, partyAPhone: contract.partyAPhone, status: contract.status }, after: { deleteReason: body.reason }, ip, ua })
      return ok(null, '合同已移入回收站')
    }

    if (body.type === 'member') {
      const member = await prisma.member.findUnique({ where: { id: body.id } })
      if (!member || member.deletedAt) return fail('会员不存在或已在回收站', 404)

      // 统计关联数据用于二次确认展示与日志（关联数据保留不动，仅计数提示）
      const orders = await prisma.order.count({ where: { memberId: body.id, deletedAt: null } })
      const projects = await prisma.project.count({ where: { memberId: body.id, deletedAt: null } })
      const realNames = await prisma.realNameAuth.count({ where: { memberId: body.id, deletedAt: null } })
      const leads = member.phone ? await prisma.lead.count({ where: { phone: member.phone, deletedAt: null } }) : 0

      // 注销会员：清空 openid/unionid（下次微信登录匹配不到，走全新账号），昵称加[已注销]，手机号保留明文（展示层脱敏）
      await prisma.member.update({
        where: { id: body.id },
        data: {
          deletedAt: now,
          deletedBy: admin.id,
          deleteReason: body.reason,
          status: 'cancelled',
          openId: null,
          unionId: null,
          nickname: member.nickname ? `${member.nickname}[已注销]` : '[已注销]',
        },
      })

      await logOperation({
        adminId: admin.id,
        username: admin.username,
        module: '会员',
        action: 'delete',
        targetType: 'member',
        targetId: body.id,
        before: { userId: member.userId, name: member.name || member.nickname, phone: member.phone },
        after: {
          deleteReason: body.reason,
          status: 'cancelled',
          keptData: { orders, projects, realNames, leads },
        },
        ip,
        ua,
      })

      return ok(null, `会员已注销（保留 ${orders} 笔订单、${projects} 个项目、${realNames} 条实名记录、${leads} 条线索）`)
    }

    return fail('未知类型', 400)
  })
}
