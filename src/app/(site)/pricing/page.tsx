import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { Section, SectionHeading } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { buildMetadata } from '@/lib/seo'
import { getPublishedPackages, parsePackageFeatures } from '@/lib/queries'
import { PricingOrder } from '@/components/pricing-order'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '服务套餐与价格',
    description:
      '抖音代运营服务套餐：月度 3000 元 / 季度 12000 元 / 年度 36000 元，为实体企业提供线上运营服务。',
    path: '/pricing',
  })
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export default async function PricingPage() {
  let packages: Awaited<ReturnType<typeof getPublishedPackages>> = []
  try {
    packages = await getPublishedPackages()
  } catch {
    packages = []
  }

  return (
    <>
      <section className="border-b border-line bg-mist py-14 sm:py-16">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">PRICING</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              服务套餐与价格
            </h1>
            <p className="section-sub">
              按周期选择代运营服务，价格透明、内容明确。可先提交订单，顾问会在 1 个工作日内与你确认服务细节。
            </p>
          </Reveal>
        </div>
      </section>

      <Section>
        {packages.length ? (
          <>
            <div className="grid gap-5 lg:grid-cols-3">
              {packages.map((pkg, i) => {
                const features = parsePackageFeatures(pkg.features)
                return (
                  <Reveal key={pkg.id} delay={i * 80}>
                    <div
                      className={`flex h-full flex-col rounded-2xl border bg-white p-6 ${
                        pkg.recommended
                          ? 'border-brand-600 shadow-lift'
                          : 'border-line shadow-soft'
                      }`}
                    >
                      {pkg.recommended ? (
                        <span className="mb-3 inline-flex w-fit rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white">
                          推荐
                        </span>
                      ) : null}
                      <h2 className="text-lg font-semibold text-ink">{pkg.name}</h2>
                      {pkg.summary ? (
                        <p className="mt-1.5 text-sm text-slate-500">{pkg.summary}</p>
                      ) : null}

                      <div className="mt-5 flex items-end gap-1.5">
                        <span className="text-3xl font-semibold tracking-tight text-ink">
                          ¥{yuan(pkg.price)}
                        </span>
                        <span className="pb-1 text-sm text-slate-400">/ {pkg.period}</span>
                      </div>
                      {pkg.originalPrice && pkg.originalPrice > pkg.price ? (
                        <div className="mt-1 text-xs text-slate-400 line-through">
                          原价 ¥{yuan(pkg.originalPrice)}
                        </div>
                      ) : null}

                      {features.length ? (
                        <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm text-slate-600">
                          {features.map((f) => (
                            <li key={f} className="flex gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </Reveal>
                )
              })}
            </div>

            <div className="mt-12">
              <SectionHeading
                eyebrow="ORDER"
                title="提交订单"
                desc="选择套餐并填写联系方式，提交后生成订单，我们的顾问会尽快与你联系确认服务内容。"
              />
              <div className="mt-8">
                <PricingOrder
                  packages={packages.map((p) => ({
                    id: p.id,
                    name: p.name,
                    period: p.period,
                    price: p.price,
                    recommended: p.recommended,
                  }))}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-slate-500">
            套餐正在配置中，你也可以通过下方咨询表单告诉我们需求，我们会为你定制方案。
          </div>
        )}
      </Section>
    </>
  )
}
