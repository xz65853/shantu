import { NextRequest } from 'next/server'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { contractStatusText, parseJsonArray, yuan, renderContractPdf } from '@/lib/contract-service'

export const dynamic = 'force-dynamic'

const editSchema = z.object({
  partyAName: z.string().trim().max(30).optional(),
  partyAPhone: z.string().trim().max(20).optional(),
  servicesJson: z.array(z.string().max(80)).max(50).optional(),
  amount: z.coerce.number().int().min(0).optional(), // 分
  periodStart: z.string().trim().max(20).optional(),
  periodEnd: z.string().trim().max(20).optional(),
  terms: z.string().max(5000).optional(),
  // 附加条款（勾选条款库，快照到 clauses_json）
  clauses: z.array(z.object({ name: z.string().max(60), content: z.string().max(5000) })).max(30).optional(),
  // 公司公章：更新到合同模板，所有使用该模板的合同生效
  sealImageUrl: z.string().max(500).optional(),
})

function parseClauses(json: string | null | undefined): { name: string; content: string }[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr
      .map((c) => ({ name: String(c?.name || ''), content: String(c?.content || '') }))
      .filter((c) => c.name || c.content)
  } catch {
    return []
  }
}

function serialize(c: { servicesJson?: string | null; [k: string]: unknown }) {
  const services = parseJsonArray(c.servicesJson ?? null)
  return {
    id: c.id as number,
    contractNo: c.contractNo as string | null,
    partyAName: c.partyAName as string,
    partyAPhone: c.partyAPhone as string,
    partyACompany: (c.partyACompany as string | null) ?? null,
    packageName: (c as { packageName?: string }).packageName || '',
    orderNo: (c as { orderNo?: string }).orderNo || '',
    amount: c.amount as number,
    amountText: `¥${yuan(c.amount as number)}`,
    servicesJson: services,
    terms: (c.terms as string | null) || '',
    clauses: parseClauses((c as { clausesJson?: string | null }).clausesJson),
    periodStart: (c.periodStart as string | null) || '',
    periodEnd: (c.periodEnd as string | null) || '',
    serviceDays: (c.serviceDays as number | null) || null,
    status: c.status as string,
    statusText: contractStatusText(c.status as string),
    orderStatus: (c as { orderStatus?: string }).orderStatus || '',
    signedAt: (c.signedAt as Date | null) || null,
    pdfUrl: (c.pdfUrl as string | null) || null,
    version: (c.version as number) || 1,
  }
}

/** 合同详情 + 版本记录（编辑区只对待签署开放） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error

  return handle(async () => {
    const { id } = await params
    const contract = await prisma.contract.findUnique({
      where: { id: Number(id) },
      include: { order: { select: { orderNo: true, packageName: true, status: true } }, template: true },
    })
    if (!contract) return fail('合同不存在', 404)

    const versions = await prisma.contractVersion.findMany({
      where: { contractId: contract.id },
      orderBy: { version: 'desc' },
      take: 50,
    })

    return ok({
      contract: {
        ...serialize(contract),
        packageName: contract.order?.packageName || '',
        orderNo: contract.order?.orderNo || '',
        orderStatus: contract.order?.status || '',
        partyBName: contract.template?.partyBName || '',
        sealImageUrl: contract.template?.sealImageUrl || '',
        templateId: contract.template?.id ?? null,
      },
      versions: versions.map((v) => ({
        version: v.version,
        adminName: v.adminName,
        changesJson: v.changesJson,
        remark: v.remark,
        createdAt: v.createdAt,
      })),
    })
  })
}

/** 编辑合同（待签署可改，已签署/已支付只读） */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, admin } = await guard('packages')
  if (error) return error

  return handle(async () => {
    const { id } = await params
    const body = await parseBody(req, editSchema)

    const contract = await prisma.contract.findUnique({
      where: { id: Number(id) },
      include: { order: true, template: true },
    })
    if (!contract) return fail('合同不存在', 404)
    if (contract.status === 'SIGNED') return fail('合同已签署，不能修改', 403, 403)
    if (contract.status === 'VOID') return fail('合同已作废，不能修改', 403, 403)
    if (contract.order?.status === 'PAID') return fail('已支付订单合同不可修改', 403, 403)

    const changes: { field: string; before: string; after: string }[] = []
    const data: Record<string, unknown> = {}

    if (body.partyAName !== undefined && body.partyAName !== contract.partyAName) {
      changes.push({ field: '客户姓名', before: contract.partyAName, after: body.partyAName })
      data.partyAName = body.partyAName
    }
    if (body.partyAPhone !== undefined && body.partyAPhone !== contract.partyAPhone) {
      changes.push({ field: '手机号', before: contract.partyAPhone, after: body.partyAPhone })
      data.partyAPhone = body.partyAPhone
    }
    if (body.servicesJson !== undefined) {
      const before = JSON.stringify(parseJsonArray(contract.servicesJson ?? null))
      const after = JSON.stringify(body.servicesJson.map((s) => s.trim()).filter(Boolean))
      if (before !== after) {
        changes.push({ field: '服务内容', before, after })
        data.servicesJson = JSON.stringify(body.servicesJson.map((s) => s.trim()).filter(Boolean))
        data.serviceContent = body.servicesJson.filter((s) => s.trim()).join('、')
      }
    }
    if (body.amount !== undefined && body.amount !== contract.amount) {
      changes.push({ field: '金额', before: String(contract.amount), after: String(body.amount) })
      data.amount = body.amount
      // 改价同步订单金额
      await prisma.order.update({ where: { id: contract.orderId }, data: { amount: body.amount } })
    }
    if (body.periodStart !== undefined && body.periodStart !== contract.periodStart) {
      changes.push({ field: '开始日期', before: contract.periodStart || '', after: body.periodStart })
      data.periodStart = body.periodStart
    }
    if (body.periodEnd !== undefined && body.periodEnd !== contract.periodEnd) {
      changes.push({ field: '结束日期', before: contract.periodEnd || '', after: body.periodEnd })
      data.periodEnd = body.periodEnd
    }
    if (body.terms !== undefined && body.terms !== (contract.terms || '')) {
      changes.push({ field: '补充条款', before: contract.terms || '', after: body.terms })
      data.terms = body.terms
    }
    if (body.clauses !== undefined) {
      const before = contract.clausesJson || ''
      const after = JSON.stringify(body.clauses)
      if (before !== after) {
        changes.push({ field: '附加条款', before, after })
        data.clausesJson = after
      }
    }

    // 公司公章：更新合同模板（公司级配置），随后重新渲染 PDF
    if (body.sealImageUrl !== undefined) {
      const nextSeal = body.sealImageUrl.trim()
      if (contract.templateId && nextSeal !== (contract.template?.sealImageUrl || '')) {
        changes.push({ field: '公司公章', before: contract.template?.sealImageUrl || '', after: nextSeal })
        await prisma.contractTemplate.update({
          where: { id: contract.templateId },
          data: { sealImageUrl: nextSeal || null },
        })
      }
    }

    if (changes.length === 0) return fail('没有需要保存的改动', 400)

    // 若改了起止日期，重算服务天数
    if (data.periodStart || data.periodEnd) {
      const s = (data.periodStart ?? contract.periodStart) as string
      const e = (data.periodEnd ?? contract.periodEnd) as string
      if (s && e) {
        const d1 = new Date(s.replace(/年|月/g, '/').replace(/日/g, ''))
        const d2 = new Date(e.replace(/年|月/g, '/').replace(/日/g, ''))
        const days = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1
        if (days > 0) {
          data.serviceDays = days
          data.periodText = `${days} 天`
        }
      }
    }

    data.version = contract.version + 1
    const updated = await prisma.contract.update({ where: { id: contract.id }, data })

    await prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        version: updated.version,
        adminId: admin?.id,
        adminName: admin?.username || '',
        changesJson: JSON.stringify(changes),
      },
    })

    // 归档旧 PDF（版本历史），再重新渲染覆盖主 PDF
    if (contract.pdfUrl) {
      const src = path.join('/www/wwwroot/shantu-web', contract.pdfUrl.replace(/^\//, ''))
      if (fs.existsSync(src)) {
        const dir = path.join('/www/wwwroot/shantu-web', 'uploads', 'contracts', 'archive')
        fs.mkdirSync(dir, { recursive: true })
        const oldName = `contract-${contract.order?.orderNo || contract.id}-v${contract.version}.pdf`
        fs.copyFileSync(src, path.join(dir, oldName))
      }
    }
    await renderContractPdf(contract.id)

    const fresh = await prisma.contract.findUnique({
      where: { id: contract.id },
      include: { order: { select: { orderNo: true, packageName: true, status: true } } },
    })
    return ok({ contract: fresh ? serialize(fresh) : null, changed: changes.length }, '已保存并重新生成 PDF')
  })
}
