import { prisma } from './db'

export type CouponCheck = {
  ok: boolean
  message?: string
  discount?: number
  finalAmount?: number
  couponId?: number
  code?: string
}

/**
 * 校验优惠码并计算抵扣（不落库；下单时在同一事务内做原子扣减）。
 * @param packagePrice 套餐原价（分）
 */
export async function checkCoupon(
  code: string,
  packagePrice: number,
  memberId?: number,
): Promise<CouponCheck> {
  const c = await prisma.coupon.findUnique({ where: { code } })
  if (!c) return { ok: false, message: '优惠码不存在' }
  if (c.status !== 'ACTIVE') return { ok: false, message: '优惠码已失效' }

  const now = new Date()
  if (c.startAt && now < c.startAt) return { ok: false, message: '优惠码尚未生效' }
  if (c.endAt && now > c.endAt) return { ok: false, message: '优惠码已过期' }
  if (c.totalCount > 0 && c.usedCount >= c.totalCount) return { ok: false, message: '优惠码已被领完' }

  if (packagePrice < c.minAmount) {
    return { ok: false, message: `未满足使用门槛（满 ¥${(c.minAmount / 100).toFixed(0)}）` }
  }

  if (memberId && c.perUserLimit > 0) {
    const used = await prisma.order.count({ where: { memberId, couponId: c.id } })
    if (used >= c.perUserLimit) return { ok: false, message: '该优惠码你已使用过' }
  }

  let discount = c.discountType === 'PERCENT' ? Math.floor((packagePrice * c.value) / 100) : c.value
  if (discount > packagePrice) discount = packagePrice

  return { ok: true, discount, finalAmount: packagePrice - discount, couponId: c.id, code: c.code }
}
