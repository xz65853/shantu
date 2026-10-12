import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { CaseForm } from '@/components/admin/case-form'
import { PageHeader } from '@/components/admin/page-header'
import { parseJsonArray } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('cases')
  const { id } = await params
  const caseId = Number(id)
  if (!Number.isFinite(caseId)) notFound()

  const item = await prisma.case.findUnique({ where: { id: caseId } })
  if (!item) notFound()

  const categories = await prisma.caseCategory.findMany({ orderBy: { sort: 'asc' } })
  const metrics = parseJsonArray<{ label: string; value: string }>(item.metrics)

  return (
    <div className="space-y-6">
      <PageHeader title="编辑案例" desc={`/${item.slug}`} />
      <CaseForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: item.id,
          title: item.title,
          slug: item.slug,
          subtitle: item.subtitle || '',
          industry: item.industry || '',
          projectType: item.projectType || '',
          clientName: item.clientName || '',
          period: item.period || '',
          cover: item.cover || '',
          summary: item.summary || '',
          background: item.background || '',
          strategy: item.strategy || '',
          execution: item.execution || '',
          result: item.result || '',
          metrics: metrics.length ? metrics : [{ label: '', value: '' }],
          showMetrics: item.showMetrics,
          gallery: parseJsonArray<string>(item.gallery),
          video: item.video || '',
          seoTitle: item.seoTitle || '',
          seoDesc: item.seoDesc || '',
          isFeatured: item.isFeatured,
          sort: item.sort,
          status: (item.status as 'DRAFT' | 'PUBLISHED' | 'OFFLINE') || 'PUBLISHED',
          categoryId: item.categoryId,
        }}
      />
    </div>
  )
}
