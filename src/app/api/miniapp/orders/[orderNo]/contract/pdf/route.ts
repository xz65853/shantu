import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { getMemberFromRequest } from '@/lib/member-auth'

/** 下载已签署合同 PDF（校验归属） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params
  const payload = await getMemberFromRequest(req)
  if (!payload) return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })

  const order = await prisma.order.findFirst({ where: { orderNo, memberId: payload.id } })
  if (!order) return NextResponse.json({ code: 404, message: '订单不存在' }, { status: 404 })

  const contract = await prisma.contract.findUnique({ where: { orderId: order.id } })
  if (!contract?.pdfUrl) return NextResponse.json({ code: 404, message: '合同未生成' }, { status: 404 })

  const filePath = path.join('/www/wwwroot/shantu-web', contract.pdfUrl.replace(/^\//, ''))
  if (!fs.existsSync(filePath)) return NextResponse.json({ code: 404, message: '合同文件缺失' }, { status: 404 })

  const buf = fs.readFileSync(filePath)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contract-${orderNo}.pdf"`,
    },
  })
}
