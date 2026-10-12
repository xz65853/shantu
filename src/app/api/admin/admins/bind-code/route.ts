import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  adminId: z.number().int().positive(),
})

/** 后台生成 6 位数字绑定码（5 分钟有效），供小程序端绑定 openid */
export async function POST(req: NextRequest) {
  const { error } = await guard('admins')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, schema)
    const admin = await prisma.admin.findUnique({ where: { id: body.adminId } })
    if (!admin) return fail('管理员不存在', 404)

    // 生成不重复的 6 位数字码
    let code = ''
    for (let i = 0; i < 5; i += 1) {
      const candidate = String(Math.floor(100000 + Math.random() * 900000))
      const dup = await prisma.adminBindCode.findFirst({
        where: { code: candidate, usedAt: null, expiresAt: { gt: new Date() } },
      })
      if (!dup) {
        code = candidate
        break
      }
    }
    if (!code) return fail('生成失败，请重试', 500)

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000)
    await prisma.adminBindCode.create({ data: { adminId: admin.id, code, expiresAt } })

    return ok({ code, expiresAt, adminName: admin.displayName }, '绑定码已生成，2 分钟内有效')
  })
}
