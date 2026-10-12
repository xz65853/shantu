import type { Metadata } from 'next'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import { Section } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { ConsultForm } from '@/components/consult-form'
import { buildMetadata } from '@/lib/seo'
import { getSettings } from '@/lib/settings'
import { getFormOptions } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '联系我们',
    description: '填写你的行业与目前遇到的问题，闪途会为你提供一份可执行的线上运营方案。',
    path: '/contact',
  })
}

export default async function ContactPage() {
  let settings: Record<string, string> = {}
  let industries: Awaited<ReturnType<typeof getFormOptions>> = []
  let requirements: Awaited<ReturnType<typeof getFormOptions>> = []

  try {
    ;[settings, industries, requirements] = await Promise.all([
      getSettings(),
      getFormOptions('industry'),
      getFormOptions('requirement'),
    ])
  } catch {
    // 降级：展示空表单
  }

  const contacts = [
    { icon: Phone, label: '联系电话', value: settings.contact_phone, href: settings.contact_phone ? `tel:${settings.contact_phone}` : '' },
    { icon: Mail, label: '邮箱', value: settings.contact_email, href: settings.contact_email ? `mailto:${settings.contact_email}` : '' },
    { icon: MapPin, label: '公司地址', value: settings.contact_address, href: '' },
    { icon: Clock, label: '服务时间', value: '周一至周日 9:00 - 21:00', href: '' },
  ].filter((item) => item.value)

  return (
    <>
      <section className="border-b border-line bg-mist py-14 sm:py-16">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">CONTACT</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">联系我们</h1>
            <p className="section-sub">
              告诉我们你的行业和目前遇到的问题，我们会尽快联系你并沟通运营方案。
            </p>
          </Reveal>
        </div>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Reveal>
              <div className="card p-6">
                <h2 className="text-base font-semibold text-ink">联系方式</h2>
                <ul className="mt-5 space-y-4">
                  {contacts.length ? (
                    contacts.map((item) => {
                      const Icon = item.icon
                      return (
                        <li key={item.label} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="text-xs text-slate-400">{item.label}</div>
                            {item.href ? (
                              <a href={item.href} className="text-[15px] font-medium text-ink hover:text-brand-700">
                                {item.value}
                              </a>
                            ) : (
                              <div className="text-[15px] font-medium text-ink">{item.value}</div>
                            )}
                          </div>
                        </li>
                      )
                    })
                  ) : (
                    <li className="text-sm text-slate-400">联系方式可在后台「网站设置」中补充</li>
                  )}
                </ul>
                {settings.wechat_qrcode ? (
                  <div className="mt-6">
                    <div className="text-xs text-slate-400">微信二维码</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings.wechat_qrcode}
                      alt="微信二维码"
                      className="mt-2 h-28 w-28 rounded-lg border border-line object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </Reveal>
          </div>

          <div id="consult">
            <Reveal delay={80}>
              <ConsultForm
                industries={industries.map((i) => ({ id: i.id, label: i.label, value: i.value || i.label }))}
              />
            </Reveal>
          </div>
        </div>
      </Section>
    </>
  )
}
