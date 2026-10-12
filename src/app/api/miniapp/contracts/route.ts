import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { contractStatusText, contractPeriodRange, yuan, fmtSignedAt } from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

/** 我的合同列表（只返回当前会员名下的合同，订单软删除的一并排除） */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const list = await prisma.contract.findMany({
      where: {
        order: { memberId: payload.id, deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        order: { select: { orderNo: true, packageName: true, status: true } },
      },
    })

    return ok({
      list: list.map((c) => ({
        id: c.id,
        contractNo: c.contractNo,
        orderNo: c.order?.orderNo || '',
        title: `${c.order?.packageName || '服务'}合同`,
        packageName: c.order?.packageName || '',
        amount: c.amount,
        amountText: `¥${yuan(c.amount)}`,
        status: c.status,
        statusText: contractStatusText(c.status),
        orderStatus: c.order?.status || '',
        signedAt: fmtSignedAt(c.signedAt),
        periodRangeText: contractPeriodRange(c),
        pdfUrl: c.pdfUrl,
      })),
    })
  })
}
