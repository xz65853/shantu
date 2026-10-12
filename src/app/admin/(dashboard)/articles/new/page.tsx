import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { ArticleForm } from '@/components/admin/article-form'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default async function ArticleNewPage() {
  await requirePermission('articles')
  const categories = await prisma.articleCategory.findMany({ orderBy: { sort: 'asc' } })

  return (
    <div className="space-y-6">
      <PageHeader title="新增文章" desc="发布后前台「运营干货」自动出现。" />
      <ArticleForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          title: '',
          slug: '',
          summary: '',
          content: '',
          cover: '',
          author: '闪途运营',
          seoTitle: '',
          seoDesc: '',
          status: 'PUBLISHED',
          publishedAt: '',
          categoryId: null,
        }}
      />
    </div>
  )
}
