import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Section } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { buildMetadata } from '@/lib/seo'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '关于闪途',
    description: '桃江闪途网络科技工作室（个体工商户），专注企业线上营销与数字化运营服务。',
    path: '/about',
  })
}

const VALUES = [
  {
    title: '围绕业务做内容',
    desc: '内容不是为发布而发布，而是围绕客户的产品、门店与目标客户设计。',
  },
  {
    title: '过程可追溯',
    desc: '账号定位、选题、拍摄、发布、数据复盘都有记录，客户知道钱花在哪里。',
  },
  {
    title: '关注有效线索',
    desc: '播放量只是过程指标，我们更关心内容带来的咨询与成交。',
  },
]

export default async function AboutPage() {
  let settings: Record<string, string> = {}
  try {
    settings = await getSettings()
  } catch {
    settings = {}
  }

  return (
    <>
      <section className="border-b border-line bg-mist py-14 sm:py-16">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">ABOUT SHANTU</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">关于闪途</h1>
            <p className="section-sub">
              {settings.about_intro ||
                '桃江闪途网络科技工作室（个体工商户），专注于企业线上营销与数字化运营服务。围绕抖音代运营、短视频、直播、本地生活、广告投放及电商运营，为实体企业提供线上内容、流量与获客解决方案。'}
            </p>
          </Reveal>
        </div>
      </section>

      <Section>
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUES.map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <div className="card h-full p-6">
                <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="bg-mist">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="section-title">我们怎么工作</h2>
            <div className="mt-6 space-y-4">
              {[
                '先了解业务：客户是谁、卖什么、现在怎么获客。',
                '再定内容方向：账号定位、人设、选题结构。',
                '进入执行循环：拍摄、发布、直播、投放。',
                '定期复盘：看数据，调整内容方向和投放策略。',
              ].map((text, i) => (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-600">
                    {i + 1}
                  </span>
                  <p className="text-[15px] leading-relaxed text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="card h-full p-8">
              <h3 className="text-base font-semibold text-ink">服务范围</h3>
              <ul className="mt-5 space-y-2.5 text-[15px] text-slate-600">
                {[
                  '抖音代运营',
                  '短视频策划与制作',
                  '直播运营',
                  '本地生活运营',
                  '广告投放',
                  '电商运营',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/services" className="btn-outline mt-7">
                查看服务详情
              </Link>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section>
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="section-title">聊聊你的业务</h2>
          <p className="section-sub mx-auto">
            不需要一开始就确定合作，先看看你的行业适合怎么做线上。
          </p>
          <Link href="/contact#consult" className="btn-primary px-6 py-3">
            免费获取运营方案
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>
    </>
  )
}
