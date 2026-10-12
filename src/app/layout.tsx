import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { getSettings } from '@/lib/settings'
import { DEFAULT_SITE_NAME } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>)
  const siteName = settings.site_name || DEFAULT_SITE_NAME
  const title = settings.seo_title || `${siteName}｜实体企业线上增长服务商`
  const description = settings.seo_description || ''
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://chenyi.ak03.cn').replace(/\/$/, '')
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    keywords: settings.seo_keywords || undefined,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      url: siteUrl,
      siteName,
      title,
      description,
      ...(settings.site_logo ? { images: [{ url: settings.site_logo }] } : {}),
    },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white">{children}</body>
    </html>
  )
}
