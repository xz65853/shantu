import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'

export const dynamic = 'force-dynamic'

/** 订单列表（手机端）：订单号/套餐/金额/客户/状态 */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)

  const url = new URL(req.url)
  const status = (url.searchParams.get('status') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const take = Math.min(Number(url.searchParams.get('take') || 50), 200)

  const where: Record<string, unknown> = { deletedAt: null }
  if (status) where.status = status
  if (keyword) {
    where.OR = [
      { orderNo: { contains: keyword } },
      { name: { contains: keyword } },
      { phone: { contains: keyword } },
      { packageName: { contains: keyword } },
    ]
  }

  const list = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      orderNo: true,
      packageName: true,
      amount: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
    },
  })

  return ok({ list })
}
