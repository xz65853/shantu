import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, fail, parseBody } from '@/lib/api'

const rollbackSchema = z.object({
  version: z.number().int().min(1),
})

/** 模板版本列表（倒序） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const { id } = await params
    const list = await prisma.contractTemplateVersion.findMany({
      where: { templateId: Number(id) },
      orderBy: { version: 'desc' },
    })
    return ok({ list })
  })
}

/** 回滚到指定版本（回滚本身记为新版本，可追溯） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const { id } = await params
    const tid = Number(id)
    const body = await parseBody(req, rollbackSchema)
    const target = await prisma.contractTemplateVersion.findUnique({
      where: { templateId_version: { templateId: tid, version: body.version } },
    })
    if (!target) return fail('版本不存在', 404)

    const current = await prisma.contractTemplate.findUnique({ where: { id: tid } })
    if (!current) return fail('模板不存在', 404)

    const t = await prisma.contractTemplate.update({
      where: { id: tid },
      data: {
        name: target.name,
        contentHtml: target.contentHtml,
        sealImageUrl: target.sealImageUrl,
        partyBName: target.partyBName,
        partyBAddress: target.partyBAddress,
        partyBPhone: target.partyBPhone,
        version: current.version + 1,
      },
    })
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
      },
    })
    return ok({ id: t.id, version: t.version }, '已回滚')
  })
}
