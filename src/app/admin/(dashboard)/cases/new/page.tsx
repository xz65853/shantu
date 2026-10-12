import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { CaseForm } from '@/components/admin/case-form'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default async function CaseNewPage() {
  await requirePermission('cases')
  const categories = await prisma.caseCategory.findMany({ orderBy: { sort: 'asc' } })

  return (
    <div className="space-y-6">
      <PageHeader title="新增案例" desc="填写后前台会自动生成案例详情页。" />
      <CaseForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          title: '',
          slug: '',
          subtitle: '',
          industry: '',
          projectType: '',
          clientName: '',
          period: '',
          cover: '',
          summary: '',
          background: '',
          strategy: '',
          execution: '',
          result: '',
          metrics: [],
          showMetrics: false,
          gallery: [],
          video: '',
          seoTitle: '',
          seoDesc: '',
          isFeatured: false,
          sort: 0,
          status: 'PUBLISHED',
          categoryId: null,
        }}
      />
    </div>
  )
}
