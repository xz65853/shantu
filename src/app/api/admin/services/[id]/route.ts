import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { serviceSchema } from '@/lib/validators'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await guard('services')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, serviceSchema)
    const sid = Number(id)
    if (!Number.isFinite(sid)) return fail('参数错误')

    const dup = await prisma.service.findFirst({ where: { slug: body.slug, id: { not: sid } } })
    if (dup) throw new Error('slug 已存在，请更换')

    const item = await prisma.service.update({
      where: { id: sid },
      data: {
        name: body.name,
        slug: body.slug,
        enName: body.enName || null,
        icon: body.icon || null,
        summary: body.summary,
        detail: body.detail || null,
        process: body.process || null,
        target: body.target || null,
        faq: body.faq || null,
        cover: body.cover || null,
        seoTitle: body.seoTitle || null,
        seoDesc: body.seoDesc || null,
        sort: body.sort,
        status: body.status,
        categoryId: body.categoryId ?? null,
      },
    })
    return ok({ id: item.id }, '服务已更新')
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await guard('services')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const sid = Number(id)
    if (!Number.isFinite(sid)) return fail('参数错误')
    await prisma.service.delete({ where: { id: sid } })
    return ok(null, '服务已删除')
  })
}
