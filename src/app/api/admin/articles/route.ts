import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { articleSchema } from '@/lib/validators'

export async function POST(req: Request) {
  const { error } = await guard('articles')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, articleSchema)
    const dup = await prisma.article.findUnique({ where: { slug: body.slug } })
    if (dup) throw new Error('slug 已存在，请更换')

    const publishedAt = body.publishedAt
      ? new Date(body.publishedAt)
      : body.status === 'PUBLISHED'
        ? new Date()
        : null

    const item = await prisma.article.create({
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
    return ok({ id: item.id, slug: item.slug }, '文章已创建')
  })
}
