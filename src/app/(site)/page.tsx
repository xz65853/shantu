import Link from 'next/link'
import { ArrowRight, Camera, Target, Video, Radio, Megaphone, Store, Check } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Section, SectionHeading } from '@/components/section'
import { ServiceCard, ArticleCard } from '@/components/cards'
import { CaseFilter, type CaseItem } from '@/components/case-filter'
import { ConsultForm } from '@/components/consult-form'
import { BannerCarousel } from '@/components/banner-carousel'
import { getSettings } from '@/lib/settings'
import {
  getActiveBanners,
  getCaseCategories,
  getFormOptions,
  getPublishedArticles,
  getPublishedCases,
  getPublishedServices,
  getPublishedPackages,
  parsePackageFeatures,
} from '@/lib/queries'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

const PAINS = [
  {
    icon: Camera,
    title: '没有内容',
    desc: '不知道拍什么、怎么拍，也没有办法持续更新。',
  },
  {
    icon: Target,
    title: '没有运营',
    desc: '账号有人发，但没有明确定位和运营策略。',
  },
  {
    icon: Store,
    title: '没有转化',
    desc: '有播放、有流量，却始终没有客户。',
  },
  {
    icon: Megaphone,
    title: '不会投放',
    desc: '广告投了，却不知道钱花在哪里、为什么没结果。',
  },
]

const ADVANTAGES = [
  { no: '01', title: '懂内容', desc: '不是简单代发视频，而是围绕客户业务设计内容。' },
  { no: '02', title: '懂平台', desc: '根据抖音等平台规则调整内容与运营方式。' },
  { no: '03', title: '懂直播', desc: '从人货场到直播数据进行分析。' },
  { no: '04', title: '懂获客', desc: '最终关注的不只是播放量，而是实际业务线索。' },
  { no: '05', title: '懂实体生意', desc: '重点服务实体企业、门店、工厂、电商等经营场景。' },
]

const FLOW = [
  { no: '01', title: '提交需求', desc: '告诉我们行业与目前遇到的问题。' },
  { no: '02', title: '沟通业务情况', desc: '梳理账号现状、产品与目标客户。' },
  { no: '03', title: '制定运营方案', desc: '输出可执行的账号、内容、投放方案。' },
  { no: '04', title: '开始执行', desc: '进入拍摄、运营、直播与复盘循环。' },
]

const HERO_TAGS = [
  { icon: Video, label: '抖音账号运营', en: 'SHORT VIDEO' },
  { icon: Camera, label: '短视频内容', en: 'CONTENT' },
  { icon: Radio, label: '直播运营', en: 'LIVE' },
  { icon: Store, label: '本地生活', en: 'LOCAL' },
  { icon: Megaphone, label: '广告投放', en: 'ADS' },
]

export default async function HomePage() {
  const [
    settings,
    services,
    cases,
    caseCategories,
    articles,
    banners,
    industries,
    requirements,
    packages,
  ] = await Promise.all([
    safe(getSettings, {} as Record<string, string>),
    safe(getPublishedServices, []),
    safe(() => getPublishedCases({ take: 6 }), [] as Awaited<ReturnType<typeof getPublishedCases>>),
    safe(getCaseCategories, []),
    safe(() => getPublishedArticles({ take: 3 }), []),
    safe(getActiveBanners, []),
    safe(() => getFormOptions('industry'), []),
    safe(() => getFormOptions('requirement'), []),
    safe(getPublishedPackages, []),
  ])

  const caseItems: CaseItem[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    industry: c.industry,
    projectType: c.projectType,
    cover: c.cover,
    summary: c.summary,
    categoryId: c.categoryId,
  }))

  const about = await safe(
    () => prisma.siteSetting.findUnique({ where: { key: 'about_intro' } }),
    null,
  )

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="grid-bg absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand-100/50 blur-3xl" />
        <div className="container-page relative py-16 sm:py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal>
              <span className="eyebrow">实体企业线上增长服务商</span>
              <h1 className="mt-5 text-[34px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-5xl lg:text-[56px]">
                让实体生意，
                <br className="hidden sm:block" />
                真正做上线上
              </h1>
              <p className="mt-5 text-[15px] font-medium text-brand-700 sm:text-base">
                抖音代运营｜短视频｜直播｜本地生活｜广告投放
              </p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-500">
                为企业提供从内容到获客的一站式线上运营服务。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/contact#consult" className="btn-primary px-6 py-3">
                  免费获取运营方案
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/cases" className="btn-outline px-6 py-3">
                  查看服务案例
                </Link>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {HERO_TAGS.map((tag, i) => {
                  const Icon = tag.icon
                  return (
                    <div
                      key={tag.label}
                      className={`card card-hover flex flex-col justify-between p-5 ${
                        i === 0 ? 'sm:min-h-[132px]' : ''
                      }`}
                    >
                      <Icon className="h-5 w-5 text-brand-600" />
                      <div className="mt-6">
                        <div className="text-[15px] font-semibold tracking-tight text-ink">
                          {tag.label}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                          {tag.en}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="card flex flex-col justify-between bg-ink p-5 text-white">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">SHANTU</span>
                  <div className="mt-6 text-[15px] font-semibold leading-snug">
                    帮助实体企业
                    <br />
                    把生意搬到线上
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Banner */}
      {banners.length > 0 && (
        <section className="container-page py-10">
          <Reveal>
            <BannerCarousel
              items={banners.map((b) => ({
                id: b.id,
                title: b.title,
                subtitle: b.subtitle,
                image: b.image,
                buttonText: b.buttonText,
                buttonLink: b.buttonLink,
              }))}
            />
          </Reveal>
        </section>
      )}

      {/* 痛点 */}
      <Section className="bg-mist">
        <SectionHeading
          eyebrow="PROBLEM"
          title="线上生意做不起来，问题可能不只是流量"
          desc="多数企业不是没有做抖音，而是缺少一套能跑通的内容、运营与获客链路。"
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAINS.map((item, i) => {
            const Icon = item.icon
            return (
              <Reveal key={item.title} delay={i * 80}>
                <div className="card h-full p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
        <Reveal delay={100}>
          <p className="mx-auto mt-10 max-w-3xl text-center text-[15px] leading-relaxed text-slate-600">
            闪途从账号、内容、直播到投放，建立完整线上运营链路。
          </p>
        </Reveal>
      </Section>

      {/* 服务 */}
      <Section>
        <SectionHeading
          eyebrow="SERVICES"
          title="我们能帮你做什么"
          desc="围绕实体企业的实际经营场景，提供可执行的线上运营服务。"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.length ? (
            services.map((service, i) => (
              <Reveal key={service.id} delay={i * 60}>
                <ServiceCard
                  slug={service.slug}
                  name={service.name}
                  enName={service.enName}
                  summary={service.summary}
                  index={i}
                />
              </Reveal>
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-line py-14 text-center text-sm text-slate-400">
              服务内容正在整理中
            </div>
          )}
        </div>
      </Section>

      {/* 优势 */}
      <Section className="bg-mist">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <span className="eyebrow">WHY SHANTU</span>
            <h2 className="section-title mt-3">为什么选择闪途</h2>
            <p className="section-sub">
              我们更愿意用具体能力说话：内容能不能落地、账号能不能持续、线索能不能真正产生。
            </p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {ADVANTAGES.map((item, i) => (
              <Reveal key={item.no} delay={i * 60}>
                <div className="card h-full p-6">
                  <span className="text-[13px] font-semibold tabular-nums text-brand-300">{item.no}</span>
                  <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* 案例 */}
      <Section>
        <SectionHeading
          eyebrow="CASES"
          title="我们正在做什么"
          desc="真实项目，真实执行过程。没有确认的数据，我们不会写在网站上。"
        />
        <div className="mt-10">
          <CaseFilter
            items={caseItems}
            categories={caseCategories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
          />
        </div>
      </Section>

      {/* 套餐 */}
      {packages.length ? (
        <Section className="bg-mist">
          <SectionHeading
            eyebrow="PRICING"
            title="服务套餐"
            desc="按周期选择，价格透明。可先提交订单，顾问确认服务内容后再付款。"
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {packages.map((pkg, i) => {
              const features = parsePackageFeatures(pkg.features).slice(0, 5)
              return (
                <Reveal key={pkg.id} delay={i * 80}>
                  <div
                    className={`flex h-full flex-col rounded-2xl border bg-white p-6 ${
                      pkg.recommended ? 'border-brand-600 shadow-lift' : 'border-line shadow-soft'
                    }`}
                  >
                    {pkg.recommended ? (
                      <span className="mb-3 inline-flex w-fit rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white">
                        推荐
                      </span>
                    ) : null}
                    <h3 className="text-lg font-semibold text-ink">{pkg.name}</h3>
                    <div className="mt-4 flex items-end gap-1.5">
                      <span className="text-3xl font-semibold tracking-tight text-ink">
                        ¥{Math.round(pkg.price / 100).toLocaleString('zh-CN')}
                      </span>
                      <span className="pb-1 text-sm text-slate-400">/ {pkg.period}</span>
                    </div>
                    {features.length ? (
                      <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm text-slate-600">
                        {features.map((f) => (
                          <li key={f} className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Link
                      href="/pricing"
                      className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:gap-2"
                    >
                      选择套餐 <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </Section>
      ) : null}

      {/* 合作流程 */}
      <Section className="bg-mist">
        <SectionHeading eyebrow="PROCESS" title="从了解，到合作，我们只需要 4 步" />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((item, i) => (
            <Reveal key={item.no} delay={i * 80}>
              <div className="card h-full p-6">
                <span className="text-[13px] font-semibold tabular-nums text-brand-300">{item.no}</span>
                <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-[15px] text-slate-600">告诉我们你的行业和目前遇到的问题</p>
            <Link href="/contact#consult" className="btn-primary px-6 py-3">
              免费获取运营方案
            </Link>
          </div>
        </Reveal>
      </Section>

      {/* 运营干货 */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="INSIGHTS"
            title="运营干货"
            desc="把抖音运营、直播与本地生活的实操经验持续写下来。"
            center={false}
          />
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            查看全部 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.length ? (
            articles.map((article, i) => (
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
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-line py-14 text-center text-sm text-slate-400">
              干货文章正在更新中
            </div>
          )}
        </div>
      </Section>

      {/* 关于 */}
      <Section className="bg-mist">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">ABOUT</span>
            <h2 className="section-title mt-3">关于闪途</h2>
            <p className="section-sub">
              {about?.value ||
                '桃江闪途网络科技工作室（个体工商户），专注于企业线上营销与数字化运营服务。围绕抖音代运营、短视频、直播、本地生活、广告投放及电商运营，为实体企业提供线上内容、流量与获客解决方案。'}
            </p>
            <Link href="/about" className="btn-outline mt-6">
              了解更多
            </Link>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: '服务方向', v: '抖音 / 短视频 / 直播 / 本地生活' },
                { k: '服务对象', v: '实体企业 / 门店 / 工厂 / 电商' },
                { k: '交付方式', v: '账号 + 内容 + 投放 + 复盘' },
                { k: '关注指标', v: '内容产出 / 有效线索 / 成交' },
              ].map((item) => (
                <div key={item.k} className="card p-5">
                  <div className="text-xs text-slate-400">{item.k}</div>
                  <div className="mt-2 text-sm font-medium leading-relaxed text-ink">{item.v}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      {/* 咨询表单 */}
      <Section id="consult">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <span className="eyebrow">GET STARTED</span>
            <h2 className="section-title mt-3">你的业务，现在遇到了什么问题？</h2>
            <p className="section-sub">
              填写需求后，我们会结合你的行业与现状，给出一份可执行的运营方向建议。
            </p>
            {settings.contact_phone ? (
              <p className="mt-6 text-sm text-slate-500">
                也可以直接拨打：
                <a href={`tel:${settings.contact_phone}`} className="font-medium text-brand-700">
                  {settings.contact_phone}
                </a>
              </p>
            ) : null}
          </Reveal>
          <Reveal delay={100}>
            <ConsultForm
              industries={industries.map((i) => ({ id: i.id, label: i.label, value: i.value || i.label }))}
              />
          </Reveal>
        </div>
      </Section>
    </>
  )
}
