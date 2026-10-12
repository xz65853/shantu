import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import {
  ensureContractForOrder,
  contractStatusText,
  contractText,
  contractPeriodRange,
  memberRealInfo,
  yuan,
  fmtSignedAt,
} from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

/**
 * 获取（不存在则自动生成）合同
 * 返回：合同字段 + 服务期限 + PDF url + 正文段落（小程序原生滚动阅读）
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNo: string }> }) {
  return handle(async () => {
    const { orderNo } = await params
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const order = await prisma.order.findFirst({ where: { orderNo, memberId: payload.id } })
    if (!order) return fail('订单不存在', 404)

    let contract
    try {
      contract = await ensureContractForOrder(order.id)
    } catch (e) {
      return fail((e as Error)?.message || '合同生成失败', 400)
    }
    if (!contract) return fail('合同生成失败', 400)

    const template = await prisma.contractTemplate.findUnique({ where: { id: contract.templateId ?? 0 } })
    const member = order.memberId ? await prisma.member.findUnique({ where: { id: order.memberId } }) : null
    const paragraphs = contractText(contract, template, memberRealInfo(member))

    return ok({
      id: contract.id,
      contractNo: contract.contractNo,
      orderNo: order.orderNo,
      packageName: order.packageName,
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
      partyBName: template?.partyBName || '',
      pdfUrl: contract.pdfUrl,
      signedAt: fmtSignedAt(contract.signedAt),
    })
  })
}
