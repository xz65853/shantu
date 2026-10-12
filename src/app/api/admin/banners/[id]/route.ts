import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { bannerSchema } from '@/lib/validators'

type Ctx = { params: Promise<{ id: string }> }

function toDate(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await guard('banners')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, bannerSchema)
    const bid = Number(id)
    if (!Number.isFinite(bid)) return fail('参数错误')

    const item = await prisma.banner.update({
      where: { id: bid },
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
    return ok({ id: item.id }, 'Banner 已更新')
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await guard('banners')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const bid = Number(id)
    if (!Number.isFinite(bid)) return fail('参数错误')
    await prisma.banner.delete({ where: { id: bid } })
    return ok(null, 'Banner 已删除')
  })
}
