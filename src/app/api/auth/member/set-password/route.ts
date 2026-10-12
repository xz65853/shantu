import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import {
  MEMBER_COOKIE,
  createMemberToken,
  genMemberUserId,
  hashMemberPassword,
} from '@/lib/member-auth'

const schema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号'),
  password: z.string().min(6, '密码至少 6 位').max(64),
})

/**
 * 给「老账号」补设密码：
 * 早期手机号直接登录的账号、以及小程序微信登录且已绑定手机号的账号没有密码，
 * 这里校验手机号存在后允许设置密码（短信通道未接入，暂不校验验证码）。
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await parseBody(req, schema)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

    const member = await prisma.member.findFirst({ where: { phone: body.phone } })
    if (!member) return fail('该手机号尚未注册，请先注册账号', 404, 404)
    if (member.status === 'BLOCKED') return fail('账号已被禁用，请联系客服', 403)
    if (member.passwordHash) return fail('该账号已设置密码，请直接登录', 400)

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: {
        passwordHash: hashMemberPassword(body.password),
        userId: member.userId || genMemberUserId(member.id),
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
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
    }) as NextResponse
    res.cookies.set(MEMBER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.headers.get('x-forwarded-proto') === 'https',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  })
}
