import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { guard, handle, ok } from '@/lib/api'
import { contractStatusText, yuan } from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

/** 合同管理列表：不按支付状态过滤，创建了合同就列出来 */
export async function GET(req: NextRequest) {
  const { error } = await guard('packages')
  if (error) return error

  return handle(async () => {
    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase()
    const keyword = (url.searchParams.get('keyword') || '').trim()

    const where: Record<string, unknown> = {}
    if (['PENDING', 'SIGNED', 'VOID'].includes(status)) where.status = status
    if (keyword) {
      where.OR = [
        { contractNo: { contains: keyword } },
        { partyAName: { contains: keyword } },
        { partyAPhone: { contains: keyword } },
        { order: { orderNo: { contains: keyword } } },
        { order: { packageName: { contains: keyword } } },
      ]
    }

    const list = await prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        order: { select: { orderNo: true, packageName: true, status: true, name: true, phone: true, company: true, member: { select: { deletedAt: true } } } },
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
        orderStatus: c.order?.status || '',
        memberCancelled: Boolean(c.order?.member?.deletedAt),
        signedAt: c.signedAt,
        pdfUrl: c.pdfUrl,
      })),
    })
  })
}
