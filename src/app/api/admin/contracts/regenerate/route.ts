import { NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { guard, handle, ok } from '@/lib/api'
import { renderContractPdf } from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

/**
 * 运维接口：重新渲染合同 PDF（仅超管）。
 * 用途：渲染逻辑升级/修复后，把历史合同（含已签合同）重出成新版 PDF。
 * - 已签合同：自动从 signatureImageUrl 读回手写签名并合成
 * - 传 body.id 只重渲染一份；不传则全量
 */
export async function POST(req: NextRequest) {
  const { error } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { id?: number; noSignature?: boolean }
    const id = Number(body?.id)
    const contracts = await prisma.contract.findMany({
      where: Number.isFinite(id) && id > 0 ? { id } : {},
      include: { order: { select: { orderNo: true } } },
    })

    const results: Array<{
      id: number
      orderNo: string
      status: string
      ok: boolean
      pdfUrl?: string
      error?: string
    }> = []

    for (const c of contracts) {
      try {
        let signature: Buffer | undefined
        if (c.status === 'SIGNED' && c.signatureImageUrl && !body?.noSignature) {
          const sigPath = path.join('/www/wwwroot/shantu-web', c.signatureImageUrl.replace(/^\//, ''))
          if (fs.existsSync(sigPath)) signature = fs.readFileSync(sigPath)
        }
        const pdfUrl = await renderContractPdf(c.id, signature)
        results.push({ id: c.id, orderNo: c.order?.orderNo || '', status: c.status, ok: true, pdfUrl })
      } catch (e) {
        results.push({
          id: c.id,
          orderNo: c.order?.orderNo || '',
          status: c.status,
          ok: false,
          error: (e as Error).message,
        })
      }
    }

    return ok({
      total: results.length,
      regenerated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    })
  })
}
