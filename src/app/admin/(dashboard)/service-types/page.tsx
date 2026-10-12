import { ServiceTypesManager } from '@/components/admin/service-types-manager'
import { PageHeader } from '@/components/admin/page-header'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ServiceTypesPage() {
  await requirePermission('packages')
  return (
    <div className="space-y-6">
      <PageHeader title="服务类型" desc="配置服务类型与日报字段；新增套餐时选择，项目日报自动按此渲染。" />
      <ServiceTypesManager />
    </div>
  )
}
