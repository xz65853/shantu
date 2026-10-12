import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { ArticleForm } from '@/components/admin/article-form'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default async function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('articles')
  const { id } = await params
  const aid = Number(id)
  if (!Number.isFinite(aid)) notFound()

  const item = await prisma.article.findUnique({ where: { id: aid } })
  if (!item) notFound()

  const categories = await prisma.articleCategory.findMany({ orderBy: { sort: 'asc' } })

  return (
    <div className="space-y-6">
      <PageHeader title="编辑文章" desc={`/blog/${item.slug}`} />
      <ArticleForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: item.id,
          title: item.title,
          slug: item.slug,
          summary: item.summary || '',
          content: item.content,
          cover: item.cover || '',
          author: item.author || '',
          seoTitle: item.seoTitle || '',
          seoDesc: item.seoDesc || '',
          status: (item.status as 'DRAFT' | 'PUBLISHED' | 'OFFLINE') || 'PUBLISHED',
          publishedAt: item.publishedAt ? item.publishedAt.toISOString() : '',
          categoryId: item.categoryId,
        }}
      />
    </div>
  )
}
