import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { getMemberFromRequest } from '@/lib/member-auth'

export const dynamic = 'force-dynamic'

/**
 * 客户手写签名原图（仅合同归属会员可看）。
 * 小程序「查看合同」页用它直接展示甲方签名图片（image 组件无法带鉴权头，
 * 因此小程序端先经 downloadFile 下载到本地再展示）。
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
    select: { signatureImageUrl: true },
  })
  if (!contract) return NextResponse.json({ code: 404, message: '合同不存在' }, { status: 404 })
  if (!contract.signatureImageUrl) {
    return NextResponse.json({ code: 400, message: '合同尚未签署' }, { status: 400 })
  }

  // signatureImageUrl 形如 /uploads/contracts/sign-XXX.png，实际位于项目根 uploads/
  const file = path.join('/www/wwwroot/shantu-web', contract.signatureImageUrl.replace(/^\//, ''))
  const root = path.join('/www/wwwroot/shantu-web', 'uploads')
  if (!file.startsWith(root + path.sep)) {
    return NextResponse.json({ code: 400, message: '非法路径' }, { status: 400 })
  }
  if (!fs.existsSync(file)) {
    return NextResponse.json({ code: 404, message: '签名文件不存在' }, { status: 404 })
  }

  const buf = fs.readFileSync(file)
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' },
  })
}
