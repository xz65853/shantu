import { guard, handle, ok, fail, parseBody } from '@/lib/api'
import { packageSchema, defaultPeriodDays } from '@/lib/validators'
import { prisma } from '@/lib/db'

export async function GET() {
  const { error } = await guard('packages')
  if (error) return error

  return handle(async () => {
    const list = await prisma.package.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: { skus: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
    })
    return ok(list)
  })
}

export async function POST(req: Request) {
  const { error } = await guard('packages')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, packageSchema)
    const exists = await prisma.package.findUnique({ where: { slug: body.slug } })
    if (exists) return fail('标识已存在，请更换')

    const created = await prisma.package.create({
      data: {
        name: body.name,
        slug: body.slug,
        period: body.period,
        periodDays: body.periodDays ?? defaultPeriodDays(body.period),
        // 表单以「元」为单位提交，库中统一存「分」
        price: Math.round(body.price * 100),
        originalPrice: body.originalPrice ? Math.round(body.originalPrice * 100) : null,
        summary: body.summary || null,
        cover: body.cover || null,
        features: JSON.stringify(body.features ?? []),
        servicesJson: JSON.stringify(body.servicesJson ?? body.features ?? []),
        recommended: body.recommended ?? false,
        status: body.status ?? 1,
        sort: body.sort ?? 0,
        templateId: body.templateId ?? null,
        serviceTypeId: body.serviceTypeId ?? null,
        skus: body.skus?.length
          ? {
              create: body.skus.map((s) => ({
                name: s.name,
                price: Math.round(s.price * 100),
                originalPrice: s.originalPrice ? Math.round(s.originalPrice * 100) : null,
                serviceDays: s.serviceDays ?? 31,
                features: s.features?.length ? JSON.stringify(s.features) : null,
                sort: s.sort ?? 0,
                status: s.status ?? 1,
              })),
            }
          : undefined,
      },
    })
    return ok(created, '套餐已创建')
  })
}
