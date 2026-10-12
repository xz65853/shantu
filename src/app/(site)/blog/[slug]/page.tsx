import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Lines } from '@/components/prose'
import { ArticleCard } from '@/components/cards'
import { buildMetadata } from '@/lib/seo'
import { getArticleBySlug, getPublishedArticles } from '@/lib/queries'
import { formatDate } from '@/lib/utils'
import { prisma } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { WatermarkOverlay } from '@/components/watermark-overlay'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  let article = null
  try {
    article = await getArticleBySlug(slug)
  } catch {
    article = null
  }
  if (!article) return buildMetadata({ title: '运营干货', path: '/blog' })
  return buildMetadata({
    title: article.seoTitle || article.title,
    description: article.seoDesc || article.summary || '',
    path: `/blog/${article.slug}`,
    image: article.cover || undefined,
  })
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params

  let article = null
  try {
    article = await getArticleBySlug(slug)
  } catch {
    article = null
  }
  if (!article) notFound()

  // 文章水印：防抄袭，固定「桃江闪途 · 原创」，后台可关
  let articleWm = false
  let articleWmText = '桃江闪途 · 原创'
  try {
    const s = await getSettings()
    articleWm = s.article_wm_enable !== '0'
    articleWmText = s.article_wm_text || '桃江闪途 · 原创'
  } catch {
    /* 忽略 */
  }

  let more: Awaited<ReturnType<typeof getPublishedArticles>> = []
  try {
    more = (await getPublishedArticles({ take: 4 })).filter((a) => a.id !== article!.id).slice(0, 3)
    // 阅读量自增（失败不影响展示）
    void prisma.article
      .update({ where: { id: article.id }, data: { views: { increment: 1 } } })
      .catch(() => undefined)
  } catch {
    more = []
  }

  return (
    <>
      {articleWm ? <WatermarkOverlay text={articleWmText} /> : null}
      <section className="border-b border-line bg-mist py-12 sm:py-14">
        <div className="container-page">
          <Reveal>
            <nav className="text-xs text-slate-400">
              <Link href="/" className="hover:text-brand-600">
                首页
              </Link>
              <span className="mx-1.5">/</span>
              <Link href="/blog" className="hover:text-brand-600">
                运营干货
              </Link>
            </nav>
            <h1 className="mt-4 max-w-3xl text-[26px] font-semibold leading-snug tracking-tight text-ink sm:text-3xl">
              {article.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {article.category?.name ? <span className="chip">{article.category.name}</span> : null}
              <span>{formatDate(article.publishedAt || article.createdAt)}</span>
              {article.author ? <span>作者：{article.author}</span> : null}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_0.9fr]">
          <article>
            {article.cover ? (
              <Reveal>
                <div className="mb-8 overflow-hidden rounded-2xl border border-line bg-mist">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={article.cover} alt={article.title} className="aspect-[21/9] w-full object-cover" />
                </div>
              </Reveal>
            ) : null}
            {article.summary ? (
              <Reveal>
                <p className="mb-6 border-l-2 border-brand-500 pl-4 text-[15px] leading-relaxed text-slate-600">
                  {article.summary}
                </p>
              </Reveal>
            ) : null}
            <Reveal delay={80}>
              <Lines text={article.content} />
            </Reveal>
          </article>

          <aside className="space-y-6">
            <Reveal>
              <div className="card bg-ink p-6 text-white">
                <h3 className="text-base font-semibold">想把这些方法落到自己的账号上？</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  告诉我们你的行业与现状，我们会给出可执行的运营方向。
                </p>
                <Link
                  href="/contact#consult"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-ink"
                >
                  免费获取运营方案
                </Link>
              </div>
            </Reveal>

            {more.length ? (
              <Reveal delay={80}>
                <div className="card p-6">
                  <h3 className="text-sm font-semibold text-ink">继续阅读</h3>
                  <ul className="mt-4 space-y-3">
                    {more.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/blog/${a.slug}`}
                          className="text-sm text-slate-600 transition hover:text-brand-700"
                        >
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="border-t border-line bg-mist py-16">
        <div className="container-page flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-ink">需要一份针对你行业的运营方案？</h2>
          <Link href="/contact#consult" className="btn-primary px-6 py-3">
            免费获取运营方案
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
