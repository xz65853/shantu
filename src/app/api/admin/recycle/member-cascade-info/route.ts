import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok } from '@/lib/api'

const CASCADE_DELETEABLE_ORDER_STATUS = ['PENDING', 'PAYING', 'CANCELLED']

/** 查询删除某会员将连带删除的关联数据统计（供前端二次确认弹窗展示） */
export async function GET(req: NextRequest) {
  const { error } = await guard('recycle')
  if (error) return error
  return handle(async () => {
    const idRaw = new URL(req.url).searchParams.get('id')
    const id = Number(idRaw)
    if (!Number.isFinite(id) || id <= 0) return fail('参数错误', 400)

    const member = await prisma.member.findUnique({ where: { id } })
    if (!member) return fail('会员不存在', 404)

    const orders = await prisma.order.findMany({ where: { memberId: id, deletedAt: null } })
    const deletableOrders = orders.filter((o) => CASCADE_DELETEABLE_ORDER_STATUS.includes(o.status))
    const keptOrders = orders.filter((o) => !CASCADE_DELETEABLE_ORDER_STATUS.includes(o.status))

    let contracts = 0
    if (deletableOrders.length) {
      contracts = await prisma.contract.count({ where: { orderId: { in: deletableOrders.map((o) => o.id) }, status: { not: 'SIGNED' }, deletedAt: null } })
    }
    const projects = await prisma.project.count({ where: { memberId: id, deletedAt: null } })
    const realNames = await prisma.realNameAuth.count({ where: { memberId: id, deletedAt: null } })
    const leads = member.phone ? await prisma.lead.count({ where: { phone: member.phone, deletedAt: null } }) : 0

    return ok({
      member: { id: member.id, userId: member.userId, name: member.name || member.nickname, phone: member.phone },
      deleteCount: { orders: deletableOrders.length, contracts, projects, realNames, leads },
      keptOrders: keptOrders.length,
    })
  })
}
