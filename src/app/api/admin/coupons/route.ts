import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, fail, parseBody } from '@/lib/api'

const createSchema = z.object({
  code: z.string().trim().min(1, '请填写优惠码').max(40),
  name: z.string().trim().min(1, '请填写名称').max(60),
  discountType: z.enum(['FIXED', 'PERCENT']),
  value: z.coerce.number().int().min(1, '优惠值需大于 0'),
  minAmount: z.coerce.number().int().min(0).optional().default(0),
  totalCount: z.coerce.number().int().min(0).optional().default(0),
  perUserLimit: z.coerce.number().int().min(1).optional().default(1),
  startAt: z.string().max(40).optional().nullable(),
  endAt: z.string().max(40).optional().nullable(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional().default('ACTIVE'),
  remark: z.string().trim().max(200).optional().default(''),
})

/** 后台：优惠码列表 */
export async function GET() {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const list = await prisma.coupon.findMany({ orderBy: { id: 'desc' }, take: 200 })
    return ok({ list })
  })
}

/** 后台：创建优惠码 */
export async function POST(req: NextRequest) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, createSchema)
    const exists = await prisma.coupon.findUnique({ where: { code: body.code } })
    if (exists) return fail('优惠码已存在', 409)

    const c = await prisma.coupon.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        discountType: body.discountType,
        value: body.value,
        minAmount: body.minAmount,
        totalCount: body.totalCount,
        perUserLimit: body.perUserLimit,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        status: body.status,
        remark: body.remark || null,
      },
    })
    return ok({ id: c.id })
  })
}
