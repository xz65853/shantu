import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { CaseFilter, type CaseItem } from '@/components/case-filter'
import { buildMetadata } from '@/lib/seo'
import { getCaseCategories, getPublishedCases } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '成功案例',
    description: '桃江闪途网络科技工作室服务的抖音运营、直播、本地生活与电商项目案例。',
    path: '/cases',
  })
}

export default async function CasesPage() {
  let cases: Awaited<ReturnType<typeof getPublishedCases>> = []
  let categories: Awaited<ReturnType<typeof getCaseCategories>> = []

  try {
    ;[cases, categories] = await Promise.all([getPublishedCases(), getCaseCategories()])
  } catch {
    cases = []
    categories = []
  }

  const items: CaseItem[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    industry: c.industry,
    projectType: c.projectType,
    cover: c.cover,
    summary: c.summary,
    categoryId: c.categoryId,
  }))

  return (
    <>
      <section className="border-b border-line bg-mist py-14 sm:py-16">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">CASES</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">成功案例</h1>
            <p className="section-sub">
              真实项目，真实执行过程。没有确认的数据，我们不会写在网站上。
            </p>
          </Reveal>
        </div>
      </section>

      <Section>
        {items.length ? (
          <CaseFilter
            items={items}
            categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-line py-20 text-center">
            <p className="text-sm text-slate-400">案例正在整理中</p>
            <Link href="/contact" className="btn-outline mt-6">
              联系我们
            </Link>
          </div>
        )}
      </Section>
    </>
  )
}
