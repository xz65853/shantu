import { NextRequest } from 'next/server'
import { handle, ok, fail, parseBody } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { checkCoupon } from '@/lib/coupon'

const schema = z.object({
  code: z.string().trim().min(1, '请输入优惠码').max(40),
  packageId: z.coerce.number().int().positive('套餐参数错误'),
})

/** 小程序：校验优惠码，返回抵扣与实付（不落库） */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await parseBody(req, schema)
    const pkg = await prisma.package.findUnique({ where: { id: body.packageId } })
    if (!pkg || pkg.status !== 1) return fail('套餐不存在或已下架', 404)

    const r = await checkCoupon(body.code, pkg.price)
    if (!r.ok) return fail(r.message || '优惠码不可用', 400)

    return ok({
      code: r.code,
      originalAmount: pkg.price,
      discount: r.discount,
      finalAmount: r.finalAmount,
    })
  })
}
