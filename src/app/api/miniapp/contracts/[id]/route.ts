import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { contractStatusText, contractText, contractPeriodRange, memberRealInfo, yuan, fmtSignedAt } from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

/** 合同详情（校验归属；小程序「我的合同 → 查看合同」用） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const contractId = Number.parseInt(id, 10)
    if (!Number.isFinite(contractId)) return fail('合同参数错误', 400)

    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, order: { memberId: payload.id } },
      include: { template: true, order: { include: { member: true } } },
    })
    if (!contract) return fail('合同不存在', 404)

    const paragraphs = contractText(contract, contract.template, memberRealInfo(contract.order?.member ?? null))

    return ok({
      id: contract.id,
      contractNo: contract.contractNo,
      orderNo: contract.order?.orderNo || '',
      packageName: contract.order?.packageName || '',
      status: contract.status,
      statusText: contractStatusText(contract.status),
      partyAName: contract.partyAName,
      partyAPhone: contract.partyAPhone,
      partyACompany: contract.partyACompany,
      serviceContent: contract.serviceContent,
      amount: contract.amount,
      amountText: `¥${yuan(contract.amount)}`,
      periodStart: contract.periodStart,
      periodEnd: contract.periodEnd,
      serviceDays: contract.serviceDays,
      periodText: contract.periodText,
      periodRangeText: contractPeriodRange(contract),
      paragraphs,
      partyBName: contract.template?.partyBName || '',
      pdfUrl: contract.pdfUrl,
      signatureImageUrl: contract.signatureImageUrl,
      signedAt: fmtSignedAt(contract.signedAt),
      orderStatus: contract.order?.status || '',
      isRealVerified: contract.order?.member?.isRealVerified || false,
    })
  })
}
