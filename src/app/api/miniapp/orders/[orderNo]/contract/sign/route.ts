import { NextRequest } from 'next/server'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { clientIp } from '@/lib/rate-limit'
import {
  computeServicePeriod,
  renderContractPdf,
  contractStatusText,
  yuan,
  fmtSignedAt,
} from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

const schema = z.object({
  signature: z.string().min(1, '请先完成手写签名'),
})

/**
 * 签署合同（后端合成，前端只上传签名图片）：
 * 1) 校验归属 + 状态为待签
 * 2) 服务期限以「签署当天」为基准重算并落库（月度 31 / 季度 93 / 年度 372 天）
 * 3) 后端把签名盖到 PDF 甲方落款处，生成最终版 PDF（含公章 + 手写签名 + 隐形水印）
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderNo: string }> }) {
  return handle(async () => {
    const { orderNo } = await params
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const order = await prisma.order.findFirst({ where: { orderNo, memberId: payload.id } })
    if (!order) return fail('订单不存在', 404)

    // 校验实名认证
    const member = await prisma.member.findUnique({ where: { id: payload.id } })
    if (!member || !member.isRealVerified) return fail('请先完成实名认证，再签署合同', 400)

    const contract = await prisma.contract.findUnique({ where: { orderId: order.id } })
    if (!contract) return fail('合同不存在，请先查看合同', 404)
    if (contract.status === 'SIGNED') return fail('合同已签署', 400)
    if (contract.status === 'VOID') return fail('合同已作废', 400)

    const body = await parseBody(req, schema)
    const signatureBuffer = Buffer.from(body.signature.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    if (signatureBuffer.length === 0) return fail('签名数据无效', 400)
    if (signatureBuffer.length > 5 * 1024 * 1024) return fail('签名图片过大，请重新签名', 400)

    const now = new Date()

    // 服务期限：开始 = 签署当天，结束 = 开始 + N - 1 天（N 取套餐 period_days 快照）
    const p = computeServicePeriod(now, order.period, order.periodDays)
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        partyACompany: order.company || contract.partyACompany,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        serviceDays: p.days,
        periodText: p.periodText,
      },
    })

    // 保存签名原图 + 后端合成最终 PDF
    const dir = path.join('/www/wwwroot/shantu-web', 'uploads', 'contracts')
    fs.mkdirSync(dir, { recursive: true })
    const sigName = `sign-${order.orderNo}.png`
    fs.writeFileSync(path.join(dir, sigName), signatureBuffer)

    const pdfUrl = await renderContractPdf(contract.id, signatureBuffer)

    // 截断到安全长度：sign_user_agent / sign_nickname 在 MySQL 里是 VARCHAR(191)，
    // 小程序 User-Agent 可能超长导致写入失败，这里统一截断防溢出
    const truncate = (s: string, max = 180) => (s && s.length > max ? s.slice(0, max) : s)

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'SIGNED',
        signatureImageUrl: `/uploads/contracts/${sigName}`,
        signedAt: now,
        signIp: truncate(clientIp(req), 45),
        signUserAgent: truncate(req.headers.get('user-agent') || ''),
        signOpenid: truncate(member?.openId || '', 64),
        signNickname: truncate(member?.nickname || ''),
        pdfUrl,
      },
    })

    return ok({
      id: updated.id,
      contractNo: updated.contractNo,
      status: updated.status,
      statusText: contractStatusText(updated.status),
      pdfUrl: updated.pdfUrl,
      signedAt: fmtSignedAt(updated.signedAt),
      periodStart: updated.periodStart,
      periodEnd: updated.periodEnd,
      serviceDays: updated.serviceDays,
      periodRangeText: `${updated.periodStart} 至 ${updated.periodEnd}，共${updated.serviceDays}天`,
      amountText: `¥${yuan(updated.amount)}`,
    })
  })
}
