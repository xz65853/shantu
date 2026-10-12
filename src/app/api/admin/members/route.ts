import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import { genMemberUserId, hashMemberPassword } from '@/lib/member-auth'
import { maskPhone } from '@/lib/contract-service'

/** 会员列表（官网 + 小程序统一） */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const { error } = await guard('members')
    if (error) return error

    const url = new URL(req.url)
    const type = url.searchParams.get('type') || '' // WEB / MINI / 空=全部
    const keyword = (url.searchParams.get('keyword') || '').trim()
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const pageSize = 20

    // 默认只显示主账号且未注销；有关键词搜索时放宽，允许命中已注销会员（运营查历史）
    const where: Record<string, unknown> = { mergedInto: null }
    if (!keyword) where.deletedAt = null
    if (type === 'WEB' || type === 'MINI') where.type = type
    if (keyword) {
      where.OR = [
        { phone: { contains: keyword } },
        { name: { contains: keyword } },
        { nickname: { contains: keyword } },
        { realName: { contains: keyword } },
        { userId: { contains: keyword.toUpperCase() } },
        { remark: { contains: keyword } },
      ]
    }

    const [total, list, webCount, miniCount, withPhone, todayNew] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { orders: true, mergedChildren: true } } },
      }),
      prisma.member.count({ where: { type: 'WEB', deletedAt: null } }),
      prisma.member.count({ where: { type: 'MINI', deletedAt: null } }),
      prisma.member.count({ where: { phone: { not: null }, deletedAt: null } }),
      prisma.member.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, deletedAt: null } }),
    ])

    return ok({
      list: list.map((m) => ({
        id: m.id,
        userId: m.userId,
        type: m.type,
        phone: m.deletedAt ? maskPhone(m.phone) : m.phone,
        isCancelled: Boolean(m.deletedAt),
        name: m.name,
        nickname: m.nickname,
        avatar: m.avatar,
        status: m.status,
        remark: m.remark,
        hasPassword: Boolean(m.passwordHash),
        source: m.source,
        isRealVerified: m.isRealVerified,
        realName: m.realName,
        orderCount: m._count.orders,
        mergedCount: m._count.mergedChildren,
        lastLoginAt: m.lastLoginAt,
        createdAt: m.createdAt,
      })),
      total,
      page,
      pageSize,
      stats: { webCount, miniCount, withPhone, todayNew },
    })
  })
}

const createSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号'),
  password: z.string().min(6, '密码至少 6 位').max(64),
  name: z.string().trim().max(30).optional(),
  type: z.enum(['WEB', 'MINI']).optional(),
  remark: z.string().trim().max(500).optional(),
})

/** 后台新建会员（直接设置初始密码） */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { error } = await guard('members')
    if (error) return error

    const body = await parseBody(req, createSchema)
    const exists = await prisma.member.findFirst({ where: { phone: body.phone, mergedInto: null, deletedAt: null } })
    if (exists) return fail('该手机号已是会员，请勿重复创建', 400)

    const created = await prisma.member.create({
      data: {
        type: body.type || 'WEB',
        phone: body.phone,
        name: body.name || null,
        passwordHash: hashMemberPassword(body.password),
        remark: body.remark || null,
      },
    })
    const member = await prisma.member.update({
      where: { id: created.id },
      data: { userId: genMemberUserId(created.id) },
    })

    return ok({
      id: member.id,
      userId: member.userId,
      phone: member.phone,
      name: member.name,
      type: member.type,
    })
  })
}
