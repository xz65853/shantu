import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { CasesTable, type CaseRow } from '@/components/admin/cases-table'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default async function AdminCasesPage() {
  await requirePermission('cases')

  const cases = await prisma.case.findMany({
    orderBy: [{ sort: 'asc' }, { id: 'desc' }],
    include: { category: { select: { name: true } } },
  })

  const rows: CaseRow[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    industry: c.industry,
    status: c.status,
    isFeatured: c.isFeatured,
    sort: c.sort,
    categoryName: c.category?.name || null,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="案例管理"
        desc="新增案例后，前台案例列表与详情页会自动生成。"
        action={
          <Link href="/admin/cases/new" className="btn-primary">
            <Plus className="h-4 w-4" /> 新增案例
          </Link>
        }
      />
      <CasesTable rows={rows} />
    </div>
  )
}
