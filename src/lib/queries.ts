import { prisma } from './db'

/** 安全 URL 解码：Next.js 15 部分场景下动态路由 params 未解码（中文仍是百分号编码），查询前兜底 */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** 前台：已发布服务 */
export async function getPublishedServices() {
  return prisma.service.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  })
}

export async function getServiceBySlug(slug: string) {
  slug = safeDecode(slug)
  return prisma.service.findFirst({
    where: { slug, status: 'PUBLISHED' },
  })
}

/** 前台：已发布案例 */
export async function getPublishedCases(opts?: { categoryId?: number; featured?: boolean; take?: number }) {
  return prisma.case.findMany({
    where: {
      status: 'PUBLISHED',
      ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts?.featured ? { isFeatured: true } : {}),
    },
    orderBy: [{ sort: 'asc' }, { id: 'desc' }],
    take: opts?.take,
    include: { category: true },
  })
}

export async function getCaseBySlug(slug: string) {
  slug = safeDecode(slug)
  return prisma.case.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true },
  })
}

export async function getCaseCategories() {
  return prisma.caseCategory.findMany({
    where: { isPublished: true },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  })
}

/** 前台：已发布文章 */
export async function getPublishedArticles(opts?: { categoryId?: number; take?: number }) {
  return prisma.article.findMany({
    where: {
      status: 'PUBLISHED',
      ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
    },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: opts?.take,
    include: { category: true },
  })
}

export async function getArticleBySlug(slug: string) {
  slug = safeDecode(slug)
  return prisma.article.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true },
  })
}

export async function getArticleCategories() {
  return prisma.articleCategory.findMany({
    where: { isPublished: true },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  })
}

/** 前台：生效中的 Banner */
export async function getActiveBanners() {
  const now = new Date()
  return prisma.banner.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  })
}

/** 前台：表单可选项 */
export async function getFormOptions(group: string) {
  return prisma.formOption.findMany({
    where: { group, isActive: true },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  })
}

/** 前台：上架套餐（价格单位：分） */
export async function getPublishedPackages() {
  return prisma.package.findMany({
    where: { status: 1 },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  })
}

export function parsePackageFeatures(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export async function getRelatedCases(caseId: number, categoryId: number | null, take = 3) {
  return prisma.case.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: caseId },
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [{ sort: 'asc' }, { id: 'desc' }],
    take,
  })
}
