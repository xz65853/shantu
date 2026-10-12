import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Section } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { buildMetadata } from '@/lib/seo'
import { getPublishedServices } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '服务项目',
    description:
      '抖音代运营、短视频运营、直播运营、本地生活、广告投放、电商运营，为实体企业提供一站式线上运营服务。',
    path: '/services',
  })
}

export default async function ServicesPage() {
  let services: Awaited<ReturnType<typeof getPublishedServices>> = []
  try {
    services = await getPublishedServices()
  } catch {
    services = []
  }

  return (
    <>
      <section className="border-b border-line bg-mist py-14 sm:py-16">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">SERVICES</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">服务项目</h1>
            <p className="section-sub">
              从账号定位、内容生产到直播与投放，覆盖实体企业做线上的关键环节。
            </p>
          </Reveal>
        </div>
      </section>

      <Section>
        {services.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => (
              <Reveal key={service.id} delay={i * 60}>
                <Link href={`/services/${service.slug}`} className="card card-hover group flex h-full flex-col p-6">
                  <div className="flex items-start justify-between">
                    <span className="text-[13px] font-semibold tabular-nums text-brand-300">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {service.enName ? (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                        {service.enName}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight text-ink">{service.name}</h2>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate-500">{service.summary}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                    查看详情{' '}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-slate-400">
            服务内容正在整理中
          </div>
        )}
      </Section>
    </>
  )
}
