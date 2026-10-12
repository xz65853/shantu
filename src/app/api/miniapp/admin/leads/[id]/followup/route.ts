import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { canMiniWrite, getMiniAdmin, writeMiniAdminLog } from '@/lib/mini-admin-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  content: z.string().trim().min(1, '请输入跟进内容').max(1000),
})

type Ctx = { params: Promise<{ id: string }> }

/** 给线索加跟进记录（写在时间线上） */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  if (!canMiniWrite(admin.role, 'followup')) return fail('该角色无操作权限', 403, 403)

  const { id } = await params
  return handle(async () => {
    const body = await parseBody(req, schema)
    const leadId = Number(id)
    if (!Number.isFinite(leadId)) return fail('参数错误')

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) return fail('线索不存在', 404)

    await prisma.leadFollowup.create({
      data: { leadId, adminId: admin.adminId, content: body.content },
    })
    await writeMiniAdminLog(admin, req, '线索', 'followup', 'lead', leadId)

    return ok({}, '跟进已记录')
  })
}
