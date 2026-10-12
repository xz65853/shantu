import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { FormsManager, type FormOptionRow } from '@/components/admin/forms-manager'

export const dynamic = 'force-dynamic'

export default async function AdminFormsPage() {
  await requirePermission('forms')
  const options = await prisma.formOption.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })

  const items: FormOptionRow[] = options.map((o) => ({
    id: o.id,
    group: o.group as 'industry' | 'requirement',
    label: o.label,
    value: o.value,
    sort: o.sort,
    isActive: o.isActive,
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="表单管理" desc="配置前台咨询表单里的行业选项与需求选项。" />
      <FormsManager items={items} />
    </div>
  )
}
