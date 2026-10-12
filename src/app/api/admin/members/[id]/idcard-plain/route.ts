import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok } from '@/lib/api'
import { decryptIdCard } from '@/lib/realname'
import { logOperation, getClientIp } from '@/lib/admin-log'

/**
 * 查看会员明文身份证（高危操作）
 * ------------------------------------------------------------------
 * 红线：
 * - 只有超级管理员（SUPER_ADMIN）可调用，其他角色一律 403
 * - 每次查看都写操作日志（谁、什么时候、看了谁的身份证号）
 * - 明文仅用于用户投诉核对，绝不导出到 Excel / 列表接口
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { admin, error } = await guard('members')
    if (error) return error

    if (!admin || admin.role !== 'SUPER_ADMIN') {
      return fail('只有超级管理员可查看明文身份证', 403, 403)
    }

    const { id } = await params
    const memberId = Number(id)
    if (!Number.isInteger(memberId)) return fail('参数错误', 400)

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) return fail('会员不存在', 404)

    const idCard = member.idCardNoEncrypted ? decryptIdCard(member.idCardNoEncrypted) : ''
    if (!idCard) return fail('该会员未登记身份证号', 400)

    // 记录查看明文日志（不落身份证明文，仅记录操作人和被查看对象）
    await logOperation({
      adminId: admin.id,
      username: admin.username,
      module: 'members',
      action: 'view_idcard_plain',
      targetType: 'member',
      targetId: memberId,
      before: null,
      after: { memberId, realName: member.realName, idCardLast4: idCard.slice(-4) },
      ip: getClientIp(req),
      ua: req.headers.get('user-agent'),
    })

    return ok({
      memberId,
      realName: member.realName || '',
      idCard,
    })
  })
}
