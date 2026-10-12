import { fullUrl } from "@/lib/full-url"
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api'
import { prisma } from '@/lib/db'

/**
 * 小程序案例列表（分页）
 * ?page=1&featured=1（精选）
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const pageSize = 10
    const featured = url.searchParams.get('featured') === '1'

    const where: Record<string, unknown> = { status: 'PUBLISHED' }
    if (featured) where.isFeatured = true

    const [total, list] = await Promise.all([
      prisma.case.count({ where }),
      prisma.case.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true },
      }),
    ])

    return ok({
      list: list.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        subtitle: c.subtitle,
        industry: c.industry,
        projectType: c.projectType,
        cover: fullUrl(c.cover),
        summary: c.summary,
        category: c.category?.name || null,
      })),
      total,
      page,
      pageSize,
    })
  })
}
