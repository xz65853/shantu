import type { Metadata } from 'next'
import { getSettings } from './settings'

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://47.111.128.91:8008').replace(/\/$/, '')
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

type PageMetaInput = {
  title: string
  description?: string
  path?: string
  image?: string
  noindex?: boolean
}

export async function buildMetadata(input: PageMetaInput): Promise<Metadata> {
  const settings = await getSettings()
  const siteName = settings.site_name || DEFAULT_SITE_NAME
  const description = input.description || settings.seo_description || ''
  const url = input.path ? absoluteUrl(input.path) : siteUrl()
  const image = input.image ? absoluteUrl(input.image) : undefined

  return {
    title: input.title.includes(siteName) ? input.title : `${input.title} | ${siteName}`,
    description,
    alternates: { canonical: url },
    keywords: settings.seo_keywords || undefined,
    openGraph: {
      title: input.title,
      description,
      url,
      siteName,
      type: 'website',
      locale: 'zh_CN',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description,
      images: image ? [image] : undefined,
    },
    robots: input.noindex ? { index: false, follow: false } : undefined,
  }
}

export const DEFAULT_SITE_NAME = '桃江闪途网络科技工作室（个体工商户）'
