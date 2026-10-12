import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { LeadsTable, type LeadRow } from '@/components/admin/leads-table'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  await requirePermission('leads')

  const leads = await prisma.lead.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 500 })

  const rows: LeadRow[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    company: l.company,
    city: l.city,
    industry: l.industry,
    requirements: l.requirements,
    source: l.source,
    sourcePage: l.sourcePage,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="客户线索"
        desc="官网咨询表单提交后自动进入这里，可修改状态、分配负责人并添加跟进记录。"
        action={
          <Link href="/admin/leads/new" className="btn-primary">
            <Plus className="h-4 w-4" /> 手动新增
          </Link>
        }
      />
      <LeadsTable rows={rows} />
    </div>
  )
}
