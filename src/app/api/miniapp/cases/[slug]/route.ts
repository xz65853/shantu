import { fullUrl } from "@/lib/full-url"
import { NextRequest } from 'next/server'
import { handle, ok, fail } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getRelatedCases } from '@/lib/queries'

/** 小程序案例详情（按 slug）+ 相关案例 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params
    const c = await prisma.case.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: { category: true },
    })
    if (!c) return fail('案例不存在', 404)

    let metrics: { label?: string; value?: string }[] = []
    try {
      const parsed = JSON.parse(c.metrics || '[]')
      if (Array.isArray(parsed)) metrics = parsed
    } catch {
      /* 忽略 */
    }
    let gallery: string[] = []
    try {
      const parsed = JSON.parse(c.gallery || '[]')
      if (Array.isArray(parsed)) gallery = parsed.filter((x) => typeof x === 'string')
    } catch {
      /* 忽略 */
    }

    const related = await getRelatedCases(c.id, c.categoryId, 3)

    return ok({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      industry: c.industry,
      projectType: c.projectType,
      cover: fullUrl(c.cover),
      summary: c.summary,
      background: c.background,
      strategy: c.strategy,
      execution: c.execution,
      result: c.result,
      metrics: c.showMetrics ? metrics : [],
      gallery: gallery.map(fullUrl),
      video: c.video,
      clientName: c.clientName,
      period: c.period,
      category: c.category?.name || null,
      related: related.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        cover: fullUrl(r.cover),
        industry: r.industry,
      })),
    })
  })
}
