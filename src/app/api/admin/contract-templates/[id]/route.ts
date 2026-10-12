import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, fail, parseBody } from '@/lib/api'

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  contentHtml: z.string().min(1).max(100000).optional(),
  sealImageUrl: z.string().max(500).nullable().optional(),
  partyBName: z.string().trim().max(80).optional(),
  partyBAddress: z.string().trim().max(200).optional(),
  partyBPhone: z.string().trim().max(40).optional(),
  partyBCreditCode: z.string().trim().max(40).optional(),
  partyBType: z.string().trim().max(20).optional(),
  partyBLegalRep: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const { id } = await params
    const body = await parseBody(req, schema)
    const tid = Number(id)
    const exists = await prisma.contractTemplate.findUnique({ where: { id: tid } })
    if (!exists) return fail('模板不存在', 404)

    const data: Record<string, unknown> = {}
    for (const k of ['name', 'contentHtml', 'partyBName', 'partyBAddress', 'partyBPhone', 'partyBCreditCode', 'partyBType', 'partyBLegalRep', 'isDefault'] as const) {
      if (body[k] !== undefined) data[k] = body[k]
    }
    if (body.sealImageUrl !== undefined) data.sealImageUrl = body.sealImageUrl
    // 每次保存版本 +1
    data.version = exists.version + 1

    const t = await prisma.contractTemplate.update({ where: { id: tid }, data })
    if (body.isDefault) {
      await prisma.contractTemplate.updateMany({ where: { id: { not: tid } }, data: { isDefault: false } })
    }
    // 记录新版本
    await prisma.contractTemplateVersion.create({
      data: {
        templateId: t.id,
        version: t.version,
        name: t.name,
        contentHtml: t.contentHtml,
        sealImageUrl: t.sealImageUrl,
        partyBName: t.partyBName,
        partyBAddress: t.partyBAddress,
        partyBPhone: t.partyBPhone,
        partyBCreditCode: t.partyBCreditCode,
        partyBType: t.partyBType,
        partyBLegalRep: t.partyBLegalRep,
      },
    })
    return ok({ id: t.id, version: t.version })
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const { id } = await params
    const tid = Number(id)
    // 有合同引用的模板不允许删除
    const used = await prisma.contract.count({ where: { templateId: tid } })
    if (used > 0) return fail('该模板已被合同引用，无法删除', 400)
    await prisma.contractTemplate.delete({ where: { id: tid } })
    return ok(null, '模板已删除')
  })
}
