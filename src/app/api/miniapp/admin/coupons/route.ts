import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, ok, parseBody } from '@/lib/api'
import { getMiniAdmin, writeMiniAdminLog } from '@/lib/mini-admin-auth'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  code: z.string().trim().min(1, '请填写优惠码').max(40),
  name: z.string().trim().min(1, '请填写名称').max(60),
  discountType: z.enum(['FIXED', 'PERCENT']),
  value: z.coerce.number().int().min(1, '优惠值需大于 0'),
  minAmount: z.coerce.number().int().min(0).optional().default(0),
  totalCount: z.coerce.number().int().min(0).optional().default(0),
  perUserLimit: z.coerce.number().int().min(1).optional().default(1),
  remark: z.string().trim().max(200).optional().default(''),
})

/** 优惠码列表（手机端） */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  const list = await prisma.coupon.findMany({ orderBy: { id: 'desc' }, take: 100 })
  return ok({ list })
}

/** 生成优惠码（手机端，仅超管/运营） */
export async function POST(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'OPERATOR') {
    return fail('没有操作权限', 403, 403)
  }

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
      startAt: null,
      endAt: null,
      status: 'ACTIVE',
      remark: body.remark || null,
    },
  })

  await writeMiniAdminLog(admin, req, 'coupons', 'create', 'coupon', c.id)
  return ok({ id: c.id, code: c.code })
}
