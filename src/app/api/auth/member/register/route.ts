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
  name: z.string().trim().max(30).optional(),
})

/** 官网会员注册：手机号 + 密码，自动生成会员ID */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await parseBody(req, schema)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

    const exists = await prisma.member.findFirst({ where: { phone: body.phone, deletedAt: null } })
    if (exists) return fail('该手机号已注册，请直接登录', 400)

    const created = await prisma.member.create({
      data: {
        type: 'WEB',
        phone: body.phone,
        name: body.name || null,
        passwordHash: hashMemberPassword(body.password),
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    })
    // 会员ID 依赖自增主键，创建后回填
    const member = await prisma.member.update({
      where: { id: created.id },
      data: { userId: genMemberUserId(created.id) },
    })

    const token = await createMemberToken({
      id: member.id,
      type: 'WEB',
      phone: member.phone || '',
      name: member.name || '',
    })

    const res = ok({
      id: member.id,
      userId: member.userId,
      phone: member.phone,
      name: member.name,
      isNew: true,
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
