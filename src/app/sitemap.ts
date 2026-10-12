import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/services'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/cases'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/pricing'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/blog'), changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/contact'), changeFrequency: 'monthly', priority: 0.8 },
  ]

  try {
    const [services, cases, articles] = await Promise.all([
      prisma.service.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }),
      prisma.case.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
      prisma.article.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
    ])

    return [
      ...staticRoutes,
      ...services.map((s) => ({
        url: absoluteUrl(`/services/${s.slug}`),
        lastModified: s.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...cases.map((c) => ({
        url: absoluteUrl(`/cases/${c.slug}`),
        lastModified: c.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...articles.map((a) => ({
        url: absoluteUrl(`/blog/${a.slug}`),
        lastModified: a.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ]
  } catch {
    return staticRoutes
  }
}
