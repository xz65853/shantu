import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { bannerSchema } from '@/lib/validators'

function toDate(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(req: Request) {
  const { error } = await guard('banners')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, bannerSchema)
    const item = await prisma.banner.create({
      data: {
        title: body.title,
        subtitle: body.subtitle || null,
        image: body.image || null,
        buttonText: body.buttonText || null,
        buttonLink: body.buttonLink || null,
        sort: body.sort,
        startAt: toDate(body.startAt),
        endAt: toDate(body.endAt),
        isActive: body.isActive ?? true,
      },
    })
    return ok({ id: item.id }, 'Banner 已创建')
  })
}
