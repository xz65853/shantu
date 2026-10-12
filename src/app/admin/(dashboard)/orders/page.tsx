import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { OrdersManager, type OrderRow } from '@/components/admin/orders-manager'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  await requirePermission('orders')

  const [list, pending, paid, paidSum] = await Promise.all([
    prisma.order.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50, include: { member: { select: { deletedAt: true, status: true, realName: true, isRealVerified: true, realVerifiedAt: true } } } }),
    prisma.order.count({ where: { status: 'PENDING', deletedAt: null } }),
    prisma.order.count({ where: { status: 'PAID', deletedAt: null } }),
    prisma.order.aggregate({ where: { status: 'PAID', deletedAt: null }, _sum: { amount: true } }),
  ])

  const rows: OrderRow[] = list.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    packageName: o.packageName,
    period: o.period,
    amount: o.amount,
    status: o.status,
    memberId: o.memberId,
    payMethod: o.payMethod,
    name: o.name,
    phone: o.phone,
    company: o.company,
    city: o.city,
    industry: o.industry,
    remark: o.remark,
    source: o.source,
    realName: o.realName,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    memberCancelled: Boolean(o.member?.deletedAt),
    member: o.member ? {
      realName: o.member.realName,
      isRealVerified: o.member.isRealVerified,
      realVerifiedAt: o.member.realVerifiedAt ? o.member.realVerifiedAt.toISOString() : null,
    } : null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="订单管理"
        desc="前台套餐下单会进入这里。确认收款后在详情里把状态改为「已支付」。"
      />
      <OrdersManager
        initial={rows}
        stats={{ PENDING: pending, PAID: paid, paidAmount: paidSum._sum.amount || 0 }}
      />
    </div>
  )
}
