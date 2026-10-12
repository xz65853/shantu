import { fullUrl } from "@/lib/full-url"
import { handle, ok } from '@/lib/api'
import { getPublishedServices } from '@/lib/queries'

/** 小程序服务列表 */
export async function GET() {
  return handle(async () => {
    const services = await getPublishedServices()
    return ok(
      services.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        enName: s.enName,
        icon: s.icon,
        summary: s.summary,
        cover: fullUrl(s.cover),
      })),
    )
  })
}
