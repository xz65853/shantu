import { NextRequest } from 'next/server'
import { guard, handle, ok } from '@/lib/api'
import { prisma } from '@/lib/db'
import type { OrderStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { error } = await guard('orders')
  if (error) return error

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || ''
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const take = Math.min(Number(url.searchParams.get('take') || 50), 200)

  return handle(async () => {
    const where: Record<string, unknown> = { deletedAt: null }
    if (status && ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'].includes(status)) {
      where.status = status as OrderStatus
    }
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { name: { contains: keyword } },
        { phone: { contains: keyword } },
        { company: { contains: keyword } },
      ]
    }

    const list = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { member: { select: { deletedAt: true, status: true, realName: true, isRealVerified: true, realVerifiedAt: true } } },
    })

    const grouped = await prisma.order.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
      _sum: { amount: true },
    })

    return ok({
      list: list.map((o) => ({ ...o, memberCancelled: Boolean(o.member?.deletedAt) })),
      stats: grouped,
    })
  })
}
