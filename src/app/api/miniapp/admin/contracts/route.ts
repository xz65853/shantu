import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'
import { contractStatusText, yuan, fmtSignedAt } from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

/** 合同列表（手机端）：看所有合同 PDF */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)

  const url = new URL(req.url)
  const keyword = (url.searchParams.get('keyword') || '').trim()

  const where: Record<string, unknown> = {}
  if (keyword) {
    where.OR = [
      { contractNo: { contains: keyword } },
      { partyAName: { contains: keyword } },
      { partyAPhone: { contains: keyword } },
      { order: { orderNo: { contains: keyword } } },
    ]
  }

  const list = await prisma.contract.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      order: { select: { orderNo: true, packageName: true, name: true, phone: true } },
    },
  })

  return ok({
    list: list.map((c) => ({
      id: c.id,
      contractNo: c.contractNo,
      name: c.order?.name || c.partyAName,
      phone: c.order?.phone || c.partyAPhone,
      packageName: c.order?.packageName || '',
      orderNo: c.order?.orderNo || '',
      amount: c.amount,
      amountText: `¥${yuan(c.amount)}`,
      status: c.status,
      statusText: contractStatusText(c.status),
      signedAt: fmtSignedAt(c.signedAt),
      pdfUrl: c.pdfUrl,
    })),
  })
}
