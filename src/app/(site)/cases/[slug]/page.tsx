import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Lines } from '@/components/prose'
import { CaseCard } from '@/components/cards'
import { WatermarkedImage } from '@/components/site/watermarked-image'
import { buildMetadata } from '@/lib/seo'
import { getCaseBySlug, getRelatedCases } from '@/lib/queries'
import { parseJsonArray } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  let item = null
  try {
    item = await getCaseBySlug(slug)
  } catch {
    item = null
  }
  if (!item) return buildMetadata({ title: '成功案例', path: '/cases' })
  return buildMetadata({
    title: item.seoTitle || item.title,
    description: item.seoDesc || item.summary || '',
    path: `/cases/${item.slug}`,
    image: item.cover || undefined,
  })
}

type Metric = { label: string; value: string }

export default async function CaseDetailPage({ params }: Props) {
  const { slug } = await params

  let item = null
  try {
    item = await getCaseBySlug(slug)
  } catch {
    item = null
  }
  if (!item) notFound()

  let related: { id: number; title: string; slug: string; industry: string | null; projectType: string | null; cover: string | null; summary: string | null }[] = []
  try {
    related = await getRelatedCases(item.id, item.categoryId, 3)
  } catch {
    related = []
  }

  const metrics = item.showMetrics ? parseJsonArray<Metric>(item.metrics) : []
  const gallery = parseJsonArray<string>(item.gallery)

  const blocks = [
    { key: 'background', title: '项目背景', content: item.background },
    { key: 'strategy', title: '运营方案', content: item.strategy },
    { key: 'execution', title: '执行内容', content: item.execution },
    { key: 'result', title: '项目结果', content: item.result },
  ].filter((b) => b.content)

  return (
    <>
      <section className="border-b border-line bg-mist py-12 sm:py-14">
        <div className="container-page">
          <Reveal>
            <nav className="text-xs text-slate-400">
              <Link href="/" className="hover:text-brand-600">
                首页
              </Link>
              <span className="mx-1.5">/</span>
              <Link href="/cases" className="hover:text-brand-600">
                案例
              </Link>
            </nav>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {item.industry ? <span className="chip">{item.industry}</span> : null}
              {item.projectType ? <span className="chip">{item.projectType}</span> : null}
              {item.period ? <span className="chip">项目周期：{item.period}</span> : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {item.title}
            </h1>
            {item.subtitle ? <p className="section-sub">{item.subtitle}</p> : null}
          </Reveal>
        </div>
      </section>

      {item.cover ? (
        <div className="container-page -mt-8 sm:-mt-10">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-mist shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.cover}
                alt={item.title}
                className="aspect-[21/9] w-full object-cover"
                loading="lazy"
              />
              </div>
          </Reveal>
        </div>
      ) : null}

      <section className="py-14 sm:py-16">
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-10">
            {item.summary ? (
              <Reveal>
                <p className="border-l-2 border-brand-500 pl-4 text-[15px] leading-relaxed text-slate-600">
                  {item.summary}
                </p>
              </Reveal>
            ) : null}

            {blocks.map((block, i) => (
              <Reveal key={block.key} delay={i * 60}>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">{block.title}</h2>
                  <div className="mt-4">
                    <Lines text={block.content} />
                  </div>
                </div>
              </Reveal>
            ))}

            {metrics.length ? (
              <Reveal>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">项目数据</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {metrics.map((m, i) => (
                      <div key={i} className="card p-5">
                        <div className="text-xs text-slate-400">{m.label}</div>
                        <div className="mt-2 text-xl font-semibold tabular-nums text-ink">{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ) : null}

            {gallery.length ? (
              <Reveal>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">数据截图</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {gallery.map((src, i) => (
                      <div key={i} className="relative overflow-hidden rounded-xl border border-line bg-mist">
                        <WatermarkedImage
                          src={src}
                          alt={`${item.title} 数据截图 ${i + 1}`}
                          text="桃江闪途网络"
                          className="aspect-[4/3] w-full"
                        />
                        <span className="absolute bottom-2 right-2 rounded bg-black/45 px-2 py-0.5 text-[11px] tracking-wide text-white">
                          数据已脱敏
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ) : null}

            {item.video ? (
              <Reveal>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">项目视频</h2>
                  <div className="mt-4 overflow-hidden rounded-xl border border-line bg-ink">
                    <video src={item.video} controls className="w-full" preload="metadata" />
                  </div>
                </div>
              </Reveal>
            ) : null}
          </div>

          <aside className="space-y-6">
            <Reveal>
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-ink">项目信息</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  {item.clientName ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">客户</dt>
                      <dd className="text-right text-slate-700">{item.clientName}</dd>
                    </div>
                  ) : null}
                  {item.industry ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">行业</dt>
                      <dd className="text-right text-slate-700">{item.industry}</dd>
                    </div>
                  ) : null}
                  {item.projectType ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">项目类型</dt>
                      <dd className="text-right text-slate-700">{item.projectType}</dd>
                    </div>
                  ) : null}
                  {item.period ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">项目周期</dt>
                      <dd className="text-right text-slate-700">{item.period}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="card bg-ink p-6 text-white">
                <h3 className="text-base font-semibold">你的项目也可以这样做</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  告诉我们你的行业与目标，我们会给出对应的运营方案。
                </p>
                <Link
                  href="/contact#consult"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-ink"
                >
                  免费获取运营方案
                </Link>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>

      {related.length ? (
        <section className="border-t border-line bg-mist py-16 sm:py-20">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight text-ink">相关案例</h2>
              <Link
                href="/cases"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600"
              >
                全部案例 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((c) => (
                <CaseCard
                  key={c.id}
                  slug={c.slug}
                  title={c.title}
                  industry={c.industry}
                  projectType={c.projectType}
                  cover={c.cover}
                  summary={c.summary}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
