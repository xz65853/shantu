import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { PackagesManager } from '@/components/admin/packages-manager'

export const dynamic = 'force-dynamic'

export default async function AdminPackagesPage() {
  await requirePermission('packages')

  const packages = await prisma.package.findMany({
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    include: { skus: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="套餐管理"
        desc="维护前台「服务套餐与价格」页展示的套餐。价格以元为单位填写，系统按分存储。"
      />
      <PackagesManager initial={packages} />
    </div>
  )
}
