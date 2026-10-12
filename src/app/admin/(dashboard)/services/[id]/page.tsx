import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { ServiceForm } from '@/components/admin/service-form'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default async function ServiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('services')
  const { id } = await params
  const sid = Number(id)
  if (!Number.isFinite(sid)) notFound()

  const item = await prisma.service.findUnique({ where: { id: sid } })
  if (!item) notFound()

  return (
    <div className="space-y-6">
      <PageHeader title="编辑服务" desc={`/services/${item.slug}`} />
      <ServiceForm
        initial={{
          id: item.id,
          name: item.name,
          slug: item.slug,
          enName: item.enName || '',
          icon: item.icon || '',
          summary: item.summary,
          detail: item.detail || '',
          process: item.process || '',
          target: item.target || '',
          faq: item.faq || '',
          cover: item.cover || '',
          seoTitle: item.seoTitle || '',
          seoDesc: item.seoDesc || '',
          sort: item.sort,
          status: (item.status as 'DRAFT' | 'PUBLISHED' | 'OFFLINE') || 'PUBLISHED',
        }}
      />
    </div>
  )
}
