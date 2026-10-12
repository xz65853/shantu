import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { guard, handle, ok } from '@/lib/api'

/** 回收站列表：order / member / lead / contract 四类软删除数据 */
export async function GET(req: NextRequest) {
  const { error } = await guard('recycle')
  if (error) return error
  return handle(async () => {
    const type = new URL(req.url).searchParams.get('type') || 'order'
    let list: unknown[] = []
    let total = 0

    if (type === 'order') {
      const rows = await prisma.order.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } })
      list = rows.map((o) => ({ id: o.id, key: o.orderNo, label: o.name, phone: o.phone, extra: `${o.packageName} / ¥${(o.amount / 100).toFixed(2)}`, status: o.status, deletedAt: o.deletedAt, deletedBy: o.deletedBy, deleteReason: o.deleteReason }))
      total = rows.length
    } else if (type === 'member') {
      const rows = await prisma.member.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } })
      list = rows.map((m) => ({ id: m.id, key: m.userId || `#${m.id}`, label: m.name || m.nickname || '未命名', phone: m.phone, extra: m.type, status: m.status, deletedAt: m.deletedAt, deletedBy: m.deletedBy, deleteReason: m.deleteReason }))
      total = rows.length
    } else if (type === 'lead') {
      const rows = await prisma.lead.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } })
      list = rows.map((l) => ({ id: l.id, key: `#${l.id}`, label: l.name, phone: l.phone, extra: l.source || '线索', status: l.status, deletedAt: l.deletedAt, deletedBy: l.deletedBy, deleteReason: l.deleteReason }))
      total = rows.length
    } else if (type === 'contract') {
      const rows = await prisma.contract.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' }, include: { order: { select: { orderNo: true } } } })
      list = rows.map((c) => ({ id: c.id, key: c.contractNo || `#${c.id}`, label: c.partyAName, phone: c.partyAPhone, extra: c.order?.orderNo || `¥${(c.amount / 100).toFixed(2)}`, status: c.status, deletedAt: c.deletedAt, deletedBy: c.deletedBy, deleteReason: c.deleteReason }))
      total = rows.length
    }

    // 解析删除人
    const ids = [...new Set(list.map((x: any) => x.deletedBy).filter(Boolean))] as number[]
    const admins = ids.length ? await prisma.admin.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } }) : []
    const nameMap = new Map(admins.map((a) => [a.id, a.username]))
    list = list.map((x: any) => ({ ...x, deletedByName: x.deletedBy ? nameMap.get(x.deletedBy) || null : null }))

    return ok({ list, total, type })
  })
}
