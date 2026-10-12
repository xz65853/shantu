import { fullUrl } from "@/lib/full-url"
import { handle, ok } from '@/lib/api'
import { getActiveBanners } from '@/lib/queries'

/** 小程序 Banner 列表（只返回生效中的） */
export async function GET() {
  return handle(async () => {
    const banners = await getActiveBanners()
    return ok(
      banners.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        image: fullUrl(b.image),
        buttonText: b.buttonText,
        buttonLink: b.buttonLink,
      })),
    )
  })
}
