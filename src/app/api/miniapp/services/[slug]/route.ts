import { fullUrl } from "@/lib/full-url"
import { NextRequest } from 'next/server'
import { handle, ok, fail } from '@/lib/api'
import { getServiceBySlug } from '@/lib/queries'

/** 小程序服务详情（按 slug） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params
    const s = await getServiceBySlug(slug)
    if (!s) return fail('服务不存在', 404)
    return ok({
      id: s.id,
      name: s.name,
      slug: s.slug,
      enName: s.enName,
      icon: s.icon,
      summary: s.summary,
      cover: fullUrl(s.cover),
      detail: s.detail,
      process: s.process,
      target: s.target,
      faq: s.faq,
    })
  })
}
