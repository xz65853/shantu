import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { getMemberFromRequest } from '@/lib/member-auth'

export const dynamic = 'force-dynamic'

/**
 * 下载合同 PDF（校验归属）
 * - 待签署：返回未签名预览版（含乙方公章 + 隐形水印）
 * - 已签署：返回最终版（公章 + 手写签名，均由后端合成）
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contractId = Number.parseInt(id, 10)
  if (!Number.isFinite(contractId)) {
    return NextResponse.json({ code: 400, message: '合同参数错误' }, { status: 400 })
  }

  const payload = await getMemberFromRequest(req)
  if (!payload) return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, order: { memberId: payload.id } },
    include: { order: { select: { orderNo: true } } },
  })
  if (!contract) return NextResponse.json({ code: 404, message: '合同不存在' }, { status: 404 })
  if (!contract.pdfUrl) return NextResponse.json({ code: 404, message: '合同 PDF 未生成' }, { status: 404 })

  const filePath = path.join('/www/wwwroot/shantu-web', contract.pdfUrl.replace(/^\//, ''))
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ code: 404, message: '合同文件缺失' }, { status: 404 })
  }

  const buf = fs.readFileSync(filePath)
  const orderNo = contract.order?.orderNo || String(contract.id)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contract-${orderNo}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
