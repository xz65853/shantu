import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import { getMemberFromRequest } from '@/lib/member-auth'
import { getPhoneNumberByCode } from '@/lib/wechat-server'
import { mergeMembers } from '@/lib/member-merge'

const schema = z.object({
  // button open-type="getPhoneNumber" 回调的 code
  code: z.string().min(1, '缺少手机号授权 code'),
})

/** 小程序绑定手机号：需先微信登录（Bearer token） */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const body = await parseBody(req, schema)
    const phone = await getPhoneNumberByCode(body.code)

    // 手机号若已被其他主账号占用 → 自动合并：老账号订单/项目迁到当前微信账号，老账号标记 mergedInto
    const occupied = await prisma.member.findFirst({
      where: { phone, id: { not: payload.id }, mergedInto: null },
    })
    if (occupied) {
      try {
        await mergeMembers(payload.id, occupied.id, { operator: 'system' })
      } catch {
        return fail('手机号关联账号合并失败，请联系客服', 409)
      }
    }

    const updated = await prisma.member.update({
      where: { id: payload.id },
      data: { phone, source: 'both' },
    })

    return ok({ phone: updated.phone, merged: Boolean(occupied) })
  })
}
