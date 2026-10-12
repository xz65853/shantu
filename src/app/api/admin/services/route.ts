import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { serviceSchema } from '@/lib/validators'

export async function POST(req: Request) {
  const { error } = await guard('services')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, serviceSchema)
    const dup = await prisma.service.findUnique({ where: { slug: body.slug } })
    if (dup) throw new Error('slug 已存在，请更换')

    const item = await prisma.service.create({
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
    return ok({ id: item.id, slug: item.slug }, '服务已创建')
  })
}
