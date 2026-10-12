import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { guard } from '@/lib/api'

export const dynamic = 'force-dynamic'

/** 后台预览/下载合同 PDF（含公章 + 签名） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error

  const { id } = await params
  const contract = await prisma.contract.findUnique({
    where: { id: Number(id) },
    include: { order: { select: { orderNo: true } } },
  })
  if (!contract) return NextResponse.json({ code: 404, message: '合同不存在' }, { status: 404 })
  if (!contract.pdfUrl) return NextResponse.json({ code: 404, message: '合同 PDF 未生成' }, { status: 404 })

  const filePath = path.join('/www/wwwroot/shantu-web', contract.pdfUrl.replace(/^\//, ''))
  if (!fs.existsSync(filePath)) return NextResponse.json({ code: 404, message: '合同文件缺失' }, { status: 404 })

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
