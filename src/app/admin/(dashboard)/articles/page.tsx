import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { AdminListActions } from '@/components/admin/list-actions'
import { formatDate } from '@/lib/utils'
import { ArticleTitleSuggester } from '@/components/admin/article-title-suggester'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下架',
}

export default async function AdminArticlesPage() {
  await requirePermission('articles')
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: 'desc' },
    include: { category: { select: { name: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="文章管理"
        desc="持续输出运营干货，为网站带来长期自然流量。"
        action={
          <Link href="/admin/articles/new" className="btn-primary">
            <Plus className="h-4 w-4" /> 新增文章
          </Link>
        }
      />

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">标题</th>
                <th className="px-5 py-3 font-medium">分类</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">发布时间</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {articles.length ? (
                articles.map((item) => (
                  <tr key={item.id} className="hover:bg-mist/60">
                    <td className="max-w-[360px] px-5 py-3">
                      <div className="truncate font-medium text-ink">{item.title}</div>
                      <div className="text-xs text-slate-400">/blog/{item.slug}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{item.category?.name || '-'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {STATUS_LABEL[item.status] || item.status}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatDate(item.publishedAt || item.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <div className='flex items-center gap-1'><ArticleTitleSuggester articleId={item.id} currentTitle={item.title} content={(item.content || '').slice(0, 500)} /><AdminListActions
                          editHref={`/admin/articles/${item.id}`}
                          previewHref={`/blog/${item.slug}`}
                          apiPath={`/api/admin/articles/${item.id}`}
                          confirmText={`确定删除文章「${item.title}」？`}                        />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-400">
                    暂无文章，点击右上角新增
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
