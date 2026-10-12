import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'

const schema = z.object({
  name: z.string().trim().min(1, '请填写条款名称').max(60),
  content: z.string().trim().min(1, '请填写条款内容').max(5000),
  isActive: z.boolean().optional().default(true),
  sort: z.number().int().min(0).optional().default(0),
})

/** 附加条款库列表 */
export async function GET() {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const list = await prisma.contractClause.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })
    return ok({ list })
  })
}

/** 新增附加条款 */
export async function POST(req: NextRequest) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)
    const c = await prisma.contractClause.create({
      data: {
        name: body.name,
        content: body.content,
        isActive: body.isActive,
        sort: body.sort,
      },
    })
    return ok({ id: c.id })
  })
}
