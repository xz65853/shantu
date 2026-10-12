import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, fail, parseBody } from '@/lib/api'

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  isActive: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const { id } = await params
    const body = await parseBody(req, schema)
    const exists = await prisma.contractClause.findUnique({ where: { id: Number(id) } })
    if (!exists) return fail('条款不存在', 404)
    const c = await prisma.contractClause.update({ where: { id: Number(id) }, data: body })
    return ok({ id: c.id })
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const { id } = await params
    await prisma.contractClause.delete({ where: { id: Number(id) } })
    return ok(null, '条款已删除')
  })
}
