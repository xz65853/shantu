import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { canMiniWrite, getMiniAdmin, writeMiniAdminLog } from '@/lib/mini-admin-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const LEAD_STATUS = ['PENDING', 'CONTACTED', 'INTENTION', 'QUOTED', 'WON', 'HOLD', 'INVALID'] as const

const schema = z.object({
  status: z.enum(LEAD_STATUS),
})

type Ctx = { params: Promise<{ id: string }> }

/** 线索详情 + 跟进时间线 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)

  const { id } = await params
  return handle(async () => {
    const leadId = Number(id)
    if (!Number.isFinite(leadId)) return fail('参数错误')

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        name: true,
        phone: true,
        company: true,
        city: true,
        industry: true,
        requirements: true,
        message: true,
        source: true,
        status: true,
        createdAt: true,
      },
    })
    if (!lead) return fail('线索不存在', 404)

    const followups = await prisma.leadFollowup.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        admin: { select: { displayName: true } },
      },
    })

    return ok({ lead, followups })
  })
}

/** 改线索状态（待联系/已联系/意向/已报价/已成交/暂不考虑/无效） */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  if (!canMiniWrite(admin.role)) return fail('该角色无操作权限', 403, 403)

  const { id } = await params
  return handle(async () => {
    const body = await parseBody(req, schema)
    const leadId = Number(id)
    if (!Number.isFinite(leadId)) return fail('参数错误')

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) return fail('线索不存在', 404)

    await prisma.lead.update({ where: { id: leadId }, data: { status: body.status } })
    await writeMiniAdminLog(admin, req, '线索', 'update', 'lead', leadId)

    return ok({ id: leadId }, '状态已更新')
  })
}
