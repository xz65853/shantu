import { NextRequest } from 'next/server'
import { handle, ok, fail } from '@/lib/api'
import { prisma } from '@/lib/db'

/** 小程序文章详情（按 slug），公开接口，无需登录 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params
    const a = await prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        id: true, title: true, slug: true, summary: true, content: true,
        cover: true, author: true, publishedAt: true, createdAt: true,
      },
    })
    if (!a) return fail('文章不存在', 404)
    return ok(a)
  })
}
