import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { ArticleCard } from '@/components/cards'
import { buildMetadata } from '@/lib/seo'
import { getArticleCategories, getPublishedArticles } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '运营干货',
    description: '抖音运营、直播运营、短视频、本地生活与电商运营的实操经验分享。',
    path: '/blog',
  })
}

export default async function BlogPage() {
  let articles: Awaited<ReturnType<typeof getPublishedArticles>> = []
  let categories: Awaited<ReturnType<typeof getArticleCategories>> = []

  try {
    ;[articles, categories] = await Promise.all([getPublishedArticles(), getArticleCategories()])
  } catch {
    articles = []
    categories = []
  }

  return (
    <>
      <section className="border-b border-line bg-mist py-14 sm:py-16">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">INSIGHTS</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">运营干货</h1>
            <p className="section-sub">
              抖音运营、直播、本地生活的实操方法与经验记录。
            </p>
          </Reveal>
        </div>
      </section>

      <Section>
        {categories.length ? (
          <div className="mb-8 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="chip">
                {c.name}
              </span>
            ))}
          </div>
        ) : null}

        {articles.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, i) => (
              <Reveal key={article.id} delay={i * 60}>
                <ArticleCard
                  slug={article.slug}
                  title={article.title}
                  summary={article.summary}
                  cover={article.cover}
                  publishedAt={article.publishedAt}
                  categoryName={article.category?.name}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-slate-400">
            干货文章正在更新中
          </div>
        )}
      </Section>
    </>
  )
}
