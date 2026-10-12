import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/admin/page-header'
import { CouponsManager } from '@/components/admin/coupons-manager'

export const dynamic = 'force-dynamic'

export default async function AdminCouponsPage() {
  await requirePermission('packages')
  const list = await prisma.coupon.findMany({ orderBy: { id: 'desc' }, take: 200 })

  return (
    <div className="space-y-6">
      <PageHeader title="优惠码" desc="创建优惠码，客户下单时输入抵扣（固定减免 / 折扣），季/年套餐可发立减码。" />
      <CouponsManager initial={list} />
    </div>
  )
}
