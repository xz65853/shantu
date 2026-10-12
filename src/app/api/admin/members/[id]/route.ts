import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import { genMemberUserId, hashMemberPassword } from '@/lib/member-auth'
import { decryptIdCard, maskIdCard } from '@/lib/realname'
import { maskPhone } from '@/lib/contract-service'

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
  remark: z.string().trim().max(500).optional(),
  name: z.string().trim().max(30).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号')
    .optional(),
  // 重置密码：不传表示不修改
  password: z.string().min(6, '密码至少 6 位').max(64).optional(),
})

/** 会员资料 / 密码 / 启停 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { error } = await guard('members')
    if (error) return error

    const { id } = await params
    const memberId = Number(id)
    if (!Number.isInteger(memberId)) return fail('参数错误', 400)

    const body = await parseBody(req, patchSchema)

    if (body.phone) {
      const dup = await prisma.member.findFirst({
        where: { phone: body.phone, NOT: { id: memberId }, deletedAt: null },
      })
      if (dup) return fail('该手机号已被其他会员使用', 400)
    }

    const current = await prisma.member.findUnique({ where: { id: memberId } })
    if (!current) return fail('会员不存在', 404)
    if (current.deletedAt) return fail('已注销会员不可编辑', 400)

    const member = await prisma.member.update({
      where: { id: memberId },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.remark !== undefined ? { remark: body.remark } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.password ? { passwordHash: hashMemberPassword(body.password) } : {}),
        // 老会员补齐会员ID
        userId: current.userId || genMemberUserId(current.id),
      },
    })
    return ok({
      id: member.id,
      userId: member.userId,
      status: member.status,
      remark: member.remark,
      name: member.name,
      phone: member.phone,
      hasPassword: Boolean(member.passwordHash),
    })
  })
}

/** 会员详情 + 该会员的订单列表 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { admin, error } = await guard('members')
    if (error) return error

    const { id } = await params
    const memberId = Number(id)
    if (!Number.isInteger(memberId)) return fail('参数错误', 400)

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        _count: { select: { orders: true } },
        mergedChildren: { orderBy: { id: 'asc' } },
        mergedTo: true,
      },
    })
    if (!member) return fail('会员不存在', 404)

    const orders = await prisma.order.findMany({
      where: { memberId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const realNameAuths = await prisma.realNameAuth.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return ok({
      member: {
        id: member.id,
        userId: member.userId,
        type: member.type,
        phone: member.deletedAt ? maskPhone(member.phone) : member.phone,
        isCancelled: Boolean(member.deletedAt),
        name: member.name,
        nickname: member.nickname,
        avatar: member.avatar,
        status: member.status,
        remark: member.remark,
        source: member.source,
        openId: Boolean(member.openId),
        hasPassword: Boolean(member.passwordHash),
        lastLoginAt: member.lastLoginAt,
        createdAt: member.createdAt,
        // 实名认证信息（只读；红线：接口只返回脱敏身份证号，不返回明文）
        isRealVerified: member.isRealVerified,
        realName: member.realName,
        idCardMasked: member.idCardNoEncrypted ? maskIdCard(decryptIdCard(member.idCardNoEncrypted)) : '',
        realVerifiedAt: member.realVerifiedAt,
        // 只有超管能查看明文身份证（前端据此显示「查看明文」按钮）
        canViewIdCardPlain: admin?.role === 'SUPER_ADMIN' && Boolean(member.idCardNoEncrypted),
      },
      realNameAuths: realNameAuths.map((a) => ({
        id: a.id,
        realName: a.realName,
        idCardMasked: a.idCardNoEnc ? maskIdCard(decryptIdCard(a.idCardNoEnc)) : '',
        status: a.status,
        verifyChannel: a.verifyChannel,
        transactionId: a.transactionId,
        failReason: a.failReason,
        verifiedAt: a.verifiedAt,
        createdAt: a.createdAt,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        packageName: o.packageName,
        amount: o.amount,
        status: o.status,
        payMethod: o.payMethod,
        payChannel: o.payChannel,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
      total: member._count.orders,
      mergedChildren: member.mergedChildren.map((s) => ({
        id: s.id,
        userId: s.userId,
        phone: s.phone,
        name: s.name,
        nickname: s.nickname,
        type: s.type,
        createdAt: s.createdAt,
      })),
      mergedTo: member.mergedTo
        ? { id: member.mergedTo.id, userId: member.mergedTo.userId, phone: member.mergedTo.phone, name: member.mergedTo.name || member.mergedTo.nickname }
        : null,
    })
  })
}
