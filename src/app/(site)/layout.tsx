import type { ReactNode } from 'react'
import { VisitorGeo } from '@/components/visitor-geo'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MobileTabbar } from '@/components/mobile-tabbar'
import { ServiceFloat } from '@/components/service-float'
import { getSettings } from '@/lib/settings'
import { recordVisit } from '@/lib/visit'

/** 官网前台外壳：只有前台页面带导航与页脚，后台/登录/支付页不套用 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>)

  // 访问统计（异步落库，不阻塞渲染；只统计前台页面）
  void recordVisit()

  return (
    <>
      <SiteHeader
        siteName={settings.site_name}
        logoText={settings.logo_text}
        logoUrl={settings.site_logo}
        phone={settings.contact_phone}
      />
      <main className="pb-16 lg:pb-0" style={{ background: "#F5F7FA" }}>{children}</main>
      <SiteFooter
        siteName={settings.site_name}
        slogan={settings.site_slogan}
        note={settings.footer_note}
        phone={settings.contact_phone}
        email={settings.contact_email}
        address={settings.contact_address}
        icp={settings.icp}
        wechatQrcode={settings.wechat_qrcode}
      />
      <MobileTabbar />
      <ServiceFloat wechatQrcode={settings.wechat_qrcode} phone={settings.contact_phone} />
      <VisitorGeo />
    </>
  )
}
