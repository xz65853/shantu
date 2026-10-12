import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { caseSchema } from '@/lib/validators'

export async function POST(req: Request) {
  const { error } = await guard('cases')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, caseSchema)
    const exists = await prisma.case.findUnique({ where: { slug: body.slug } })
    if (exists) throw new Error('slug 已存在，请更换')

    const item = await prisma.case.create({
      data: {
        title: body.title,
        slug: body.slug,
        subtitle: body.subtitle || null,
        industry: body.industry || null,
        projectType: body.projectType || null,
        clientName: body.clientName || null,
        period: body.period || null,
        cover: body.cover || null,
        summary: body.summary || null,
        background: body.background || null,
        strategy: body.strategy || null,
        execution: body.execution || null,
        result: body.result || null,
        metrics: body.metrics || null,
        showMetrics: body.showMetrics ?? false,
        gallery: body.gallery || null,
        video: body.video || null,
        seoTitle: body.seoTitle || null,
        seoDesc: body.seoDesc || null,
        isFeatured: body.isFeatured ?? false,
        sort: body.sort,
        status: body.status,
        categoryId: body.categoryId ?? null,
      },
    })
    return ok({ id: item.id, slug: item.slug }, '案例已创建')
  })
}
