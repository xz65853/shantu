import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'
import { decryptIdCard, maskIdCard } from '@/lib/realname'

export const dynamic = 'force-dynamic'

/** 会员查询（手机端）：按手机号搜客户档案 + 实名认证状态（身份证仅脱敏） */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)

  const url = new URL(req.url)
  const phone = (url.searchParams.get('phone') || '').trim()
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail('请输入正确的 11 位手机号', 400)

  const member = await prisma.member.findFirst({
    where: { phone, mergedInto: null, deletedAt: null },
    include: { _count: { select: { orders: true } } },
  })
  if (!member) return fail('未找到该手机号的会员', 404)

  return ok({
    id: member.id,
    userId: member.userId,
    phone: member.phone,
    name: member.name,
    nickname: member.nickname,
    status: member.status,
    isRealVerified: member.isRealVerified,
    realName: member.realName,
    idCardMasked: member.idCardNoEncrypted ? maskIdCard(decryptIdCard(member.idCardNoEncrypted)) : '',
    realVerifiedAt: member.realVerifiedAt,
    orderCount: member._count.orders,
    lastLoginAt: member.lastLoginAt,
    createdAt: member.createdAt,
  })
}
