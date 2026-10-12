import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Lines, BulletLines } from '@/components/prose'
import { CaseCard } from '@/components/cards'
import { buildMetadata } from '@/lib/seo'
import { getServiceBySlug, getPublishedServices } from '@/lib/queries'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  let service = null
  try {
    service = await getServiceBySlug(slug)
  } catch {
    service = null
  }
  if (!service) return buildMetadata({ title: '服务项目', path: '/services' })
  return buildMetadata({
    title: service.seoTitle || service.name,
    description: service.seoDesc || service.summary,
    path: `/services/${service.slug}`,
  })
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params

  let service = null
  try {
    service = await getServiceBySlug(slug)
  } catch {
    service = null
  }
  if (!service) notFound()

  let others: Awaited<ReturnType<typeof getPublishedServices>> = []
  let cases: { id: number; title: string; slug: string; industry: string | null; projectType: string | null; cover: string | null; summary: string | null }[] = []
  try {
    others = (await getPublishedServices()).filter((s) => s.id !== service!.id)
    cases = await prisma.case.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { sort: 'asc' },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        industry: true,
        projectType: true,
        cover: true,
        summary: true,
      },
    })
  } catch {
    // 忽略
  }

  return (
    <>
      <section className="border-b border-line bg-mist py-14 sm:py-16">
        <div className="container-page">
          <Reveal>
            <nav className="text-xs text-slate-400">
              <Link href="/" className="hover:text-brand-600">
                首页
              </Link>
              <span className="mx-1.5">/</span>
              <Link href="/services" className="hover:text-brand-600">
                服务
              </Link>
            </nav>
            {service.enName ? (
              <div className="mt-4 text-[11px] uppercase tracking-[0.2em] text-brand-400">
                {service.enName}
              </div>
            ) : null}
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {service.name}
            </h1>
            <p className="section-sub">{service.summary}</p>
            <Link href="/contact#consult" className="btn-primary mt-7">
              免费获取运营方案
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-12">
            {service.detail ? (
              <Reveal>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">服务内容</h2>
                  <div className="mt-4">
                    <Lines text={service.detail} />
                  </div>
                </div>
              </Reveal>
            ) : null}

            {service.process ? (
              <Reveal>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">服务流程</h2>
                  <div className="mt-4">
                    <BulletLines text={service.process} />
                  </div>
                </div>
              </Reveal>
            ) : null}

            {service.target ? (
              <Reveal>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">适合客户</h2>
                  <div className="mt-4">
                    <BulletLines text={service.target} />
                  </div>
                </div>
              </Reveal>
            ) : null}

            {service.faq ? (
              <Reveal>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">常见问题</h2>
                  <div className="mt-4">
                    <Lines text={service.faq} />
                  </div>
                </div>
              </Reveal>
            ) : null}
          </div>

          <aside className="space-y-6">
            <Reveal>
              <div className="card bg-ink p-6 text-white">
                <h3 className="text-base font-semibold">想了解这套服务怎么做？</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  告诉我们你的行业、门店或产品情况，我们会给出一份可执行的运营方向。
                </p>
                <Link
                  href="/contact#consult"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-ink"
                >
                  提交需求
                </Link>
              </div>
            </Reveal>

            {others.length ? (
              <Reveal delay={80}>
                <div className="card p-6">
                  <h3 className="text-sm font-semibold text-ink">其他服务</h3>
                  <ul className="mt-4 space-y-2">
                    {others.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/services/${s.slug}`}
                          className="flex items-center justify-between py-1.5 text-sm text-slate-600 transition hover:text-brand-700"
                        >
                          {s.name}
                          <ArrowRight className="h-3.5 w-3.5" />
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

      {cases.length ? (
        <section className="border-t border-line bg-mist py-16 sm:py-20">
          <div className="container-page">
            <h2 className="text-xl font-semibold tracking-tight text-ink">相关案例</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cases.map((c) => (
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
