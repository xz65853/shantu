import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { articleSchema } from '@/lib/validators'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await guard('articles')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, articleSchema)
    const aid = Number(id)
    if (!Number.isFinite(aid)) return fail('参数错误')

    const dup = await prisma.article.findFirst({ where: { slug: body.slug, id: { not: aid } } })
    if (dup) throw new Error('slug 已存在，请更换')

    const current = await prisma.article.findUnique({ where: { id: aid } })
    let publishedAt: Date | null = body.publishedAt ? new Date(body.publishedAt) : (current?.publishedAt ?? null)
    if (!body.publishedAt && body.status === 'PUBLISHED' && !current?.publishedAt) {
      publishedAt = new Date()
    }

    const item = await prisma.article.update({
      where: { id: aid },
      data: {
        title: body.title,
        slug: body.slug,
        summary: body.summary || null,
        content: body.content,
        cover: body.cover || null,
        author: body.author || null,
        seoTitle: body.seoTitle || null,
        seoDesc: body.seoDesc || null,
        status: body.status,
        publishedAt,
        categoryId: body.categoryId ?? null,
      },
    })
    return ok({ id: item.id }, '文章已更新')
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await guard('articles')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const aid = Number(id)
    if (!Number.isFinite(aid)) return fail('参数错误')
    await prisma.article.delete({ where: { id: aid } })
    return ok(null, '文章已删除')
  })
}
