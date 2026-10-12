import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import {
  MEMBER_COOKIE,
  createMemberToken,
  findMemberByAccount,
  verifyMemberPassword,
} from '@/lib/member-auth'

const schema = z.object({
  // 登录账号：手机号 或 会员ID（TJ100001）
  account: z.string().trim().min(4, '请输入手机号或会员ID').max(30),
  password: z.string().min(6, '密码至少 6 位').max(64),
})

/** 官网会员登录：账号（手机号 / 会员ID）+ 密码 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await parseBody(req, schema)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

    const member = await findMemberByAccount(body.account)
    if (!member) return fail('账号不存在，请先注册', 404, 404)
    if (member.status === 'BLOCKED') return fail('账号已被禁用，请联系客服', 403)

    if (!member.passwordHash) {
      // 历史账号（手机号直接登录过 / 仅微信登录）尚未设置密码
      return fail('该账号尚未设置密码，请先在登录页设置密码', 409, 409)
    }
    if (!verifyMemberPassword(body.password, member.passwordHash)) {
      return fail('账号或密码错误', 401, 401)
    }

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    })

    const token = await createMemberToken({
      id: updated.id,
      type: (updated.type === 'MINI' ? 'MINI' : 'WEB') as 'WEB' | 'MINI',
      phone: updated.phone || '',
      name: updated.name || updated.nickname || '',
    })

    const res = ok({
      id: updated.id,
      userId: updated.userId,
      phone: updated.phone,
      name: updated.name,
      nickname: updated.nickname,
      hasPassword: true,
    }) as NextResponse
    res.cookies.set(MEMBER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.headers.get('x-forwarded-for') ? req.headers.get('x-forwarded-proto') === 'https' : false,
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  })
}
