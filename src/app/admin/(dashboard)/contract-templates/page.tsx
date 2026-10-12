import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { ContractTemplatesManager } from '@/components/admin/contract-templates-manager'

export const dynamic = 'force-dynamic'

export default async function AdminContractTemplatesPage() {
  await requirePermission('packages')

  return (
    <div className="space-y-6">
      <PageHeader
        title="合同模板"
        desc="维护合同模板（含占位符变量）、附加条款库与版本回滚；可一键用 AI 起草合同正文。下单时按套餐指定模板自动套用。"
      />
      <ContractTemplatesManager />
    </div>
  )
}
