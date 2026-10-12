import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { mergeMembers } from '@/lib/member-merge'

const schema = z.object({
  targetId: z.coerce.number().int().positive('目标会员参数错误'),
  sourcePhone: z.string().trim().regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号'),
})

/** 手动合并会员：把 sourcePhone 对应账号合并进 targetId（后台二次确认后调用） */
export async function POST(req: NextRequest) {
  const { admin, error } = await guard('members')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)

    const target = await prisma.member.findUnique({ where: { id: body.targetId } })
    if (!target) return fail('目标会员不存在', 404)
    if (target.mergedInto) return fail('目标会员本身是子账号，请选择主账号', 400)

    const source = await prisma.member.findFirst({
      where: { phone: body.sourcePhone, mergedInto: null, deletedAt: null, id: { not: body.targetId } },
    })
    if (!source) return fail('未找到该手机号对应的会员（或已被合并）', 404)

    try {
      await mergeMembers(body.targetId, source.id, { operator: 'admin', adminId: admin.id })
      return ok(null, '合并成功')
    } catch (e) {
      return fail(e instanceof Error ? e.message : '合并失败', 400)
    }
  })
}
