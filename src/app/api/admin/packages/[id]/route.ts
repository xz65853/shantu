import { guard, handle, ok, fail, parseBody } from '@/lib/api'
import { packageSchema, defaultPeriodDays } from '@/lib/validators'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: Request, ctx: Ctx) {
  const { error } = await guard('packages')
  if (error) return error

  const { id } = await ctx.params
  return handle(async () => {
    const body = await parseBody(req, packageSchema)
    const target = await prisma.package.findUnique({ where: { id: Number(id) } })
    if (!target) return fail('套餐不存在', 404)

    const conflict = await prisma.package.findFirst({
      where: { slug: body.slug, id: { not: Number(id) } },
    })
    if (conflict) return fail('标识已存在，请更换')

    const updated = await prisma.package.update({
      where: { id: Number(id) },
      data: {
        name: body.name,
        slug: body.slug,
        period: body.period,
        periodDays: body.periodDays ?? defaultPeriodDays(body.period),
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
      },
    })

    // SKU 全量替换（删除重建；订单已有 skuName 快照，历史可追溯）
    if (Array.isArray(body.skus)) {
      await prisma.$transaction(async (tx) => {
        await tx.packageSku.deleteMany({ where: { packageId: Number(id) } })
        if (body.skus!.length) {
          await tx.packageSku.createMany({
            data: body.skus!.map((s) => ({
              packageId: Number(id),
              name: s.name,
              price: Math.round(s.price * 100),
              originalPrice: s.originalPrice ? Math.round(s.originalPrice * 100) : null,
              serviceDays: s.serviceDays ?? 31,
              features: s.features?.length ? JSON.stringify(s.features) : null,
              sort: s.sort ?? 0,
              status: s.status ?? 1,
            })),
          })
        }
      })
    }
    return ok(updated, '套餐已更新')
  })
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { error } = await guard('packages')
  if (error) return error

  const { id } = await ctx.params
  return handle(async () => {
    const target = await prisma.package.findUnique({ where: { id: Number(id) } })
    if (!target) return fail('套餐不存在', 404)

    // 直接删除（含 SKU 级联删除）。
    // 订单外键均为 SetNull：删除后历史订单自动解绑（packageId/skuId 置空），
    // 订单上的套餐名 / 规格名 / 服务项 / 天数快照完整保留，不影响对账与合同。
    const orderCount = await prisma.order.count({ where: { packageId: Number(id) } })
    await prisma.package.delete({ where: { id: Number(id) } })

    return ok(
      null,
      orderCount
        ? `套餐已删除，${orderCount} 条历史订单已保留（套餐信息以订单快照为准）`
        : '套餐已删除',
    )
  })
}
