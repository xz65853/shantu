import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, fail, parseBody } from '@/lib/api'
import { getSettings } from '@/lib/settings'

const schema = z.object({
  name: z.string().trim().min(1, '请填写模板名称').max(60),
  contentHtml: z.string().min(1, '请填写合同正文').max(100000),
  sealImageUrl: z.string().max(500).optional().default(''),
  partyBName: z.string().trim().max(80).optional().default(''),
  partyBAddress: z.string().trim().max(200).optional().default(''),
  partyBPhone: z.string().trim().max(40).optional().default(''),
  partyBCreditCode: z.string().trim().max(40).optional().default(''),
  partyBType: z.string().trim().max(20).optional().default('individual'),
  partyBLegalRep: z.string().trim().max(40).optional().default(''),
  isDefault: z.boolean().optional().default(false),
})

export async function GET() {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const list = await prisma.contractTemplate.findMany({
      orderBy: { id: 'desc' },
      include: { _count: { select: { versions: true } } },
    })
    return ok({ list })
  })
}

export async function POST(req: NextRequest) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)
    const settings = await getSettings().catch(() => ({}) as Record<string, string>)
    const t = await prisma.contractTemplate.create({
      data: {
        name: body.name,
        contentHtml: body.contentHtml,
        sealImageUrl: body.sealImageUrl || null,
        partyBName: body.partyBName || settings.site_name || '',
        partyBAddress: body.partyBAddress || settings.contact_address || '',
        partyBPhone: body.partyBPhone || settings.contact_phone || '',
        partyBCreditCode: body.partyBCreditCode || '',
        partyBType: body.partyBType || 'individual',
        partyBLegalRep: body.partyBLegalRep || '',
        isDefault: body.isDefault,
        version: 1,
      },
    })
    if (body.isDefault) {
      await prisma.contractTemplate.updateMany({ where: { id: { not: t.id } }, data: { isDefault: false } })
    }
    // 记录初始版本
    await prisma.contractTemplateVersion.create({
      data: {
        templateId: t.id,
        version: 1,
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
    return ok({ id: t.id })
  })
}
