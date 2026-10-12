import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { caseSchema } from '@/lib/validators'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await guard('cases')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, caseSchema)
    const caseId = Number(id)
    if (!Number.isFinite(caseId)) return fail('参数错误')

    const dup = await prisma.case.findFirst({
      where: { slug: body.slug, id: { not: caseId } },
    })
    if (dup) throw new Error('slug 已存在，请更换')

    const item = await prisma.case.update({
      where: { id: caseId },
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
    return ok({ id: item.id, slug: item.slug }, '案例已更新')
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await guard('cases')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const caseId = Number(id)
    if (!Number.isFinite(caseId)) return fail('参数错误')
    await prisma.case.delete({ where: { id: caseId } })
    return ok(null, '案例已删除')
  })
}
