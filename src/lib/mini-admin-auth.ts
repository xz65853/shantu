import { prisma } from './db'
import { getMemberFromRequest } from './member-auth'

/**
 * 小程序端管理后台鉴权（与电脑后台 cookie 会话相互独立）。
 * 链路：Bearer member token → 会员 openId → admins.open_id 白名单（且 isActive）。
 * 普通会员 / 未绑定 openid 的管理员 / 被禁用的管理员 → 返回 null。
 */

export type MiniAdmin = {
  adminId: number
  role: string
  name: string
  phone: string
  memberId: number
  openId: string
}

export async function getMiniAdmin(req: Request): Promise<MiniAdmin | null> {
  const payload = await getMemberFromRequest(req)
  if (!payload) return null
  const member = await prisma.member.findFirst({
    where: { id: payload.id, status: 'ACTIVE', deletedAt: null },
    select: { id: true, openId: true },
  })
  if (!member || !member.openId) return null
  const admin = await prisma.admin.findFirst({
    where: { openId: member.openId, isActive: true },
  })
  if (!admin) return null
  return {
    adminId: admin.id,
    role: admin.role,
    name: admin.displayName,
    phone: admin.phone || '',
    memberId: member.id,
    openId: member.openId,
  }
}

/** 手机端可写角色（超管 / 运营 / 财务）；只读角色仅查看 */
const WRITE_ROLES = ['SUPER_ADMIN', 'OPERATOR', 'FINANCE']
/** 改订单金额仅超管 / 财务 */
const AMOUNT_ROLES = ['SUPER_ADMIN', 'FINANCE']

export function canMiniWrite(role: string, action?: 'amount' | 'status' | 'daily' | 'followup') {
  if (action === 'amount') return AMOUNT_ROLES.includes(role)
  return WRITE_ROLES.includes(role)
}

/** 记录小程序管理端操作日志（复用 admin_operation_logs） */
export async function writeMiniAdminLog(
  admin: MiniAdmin,
  req: Request,
  module: string,
  action: string,
  targetType?: string,
  targetId?: number
) {
  try {
    await prisma.adminOperationLog.create({
      data: {
        adminId: admin.adminId,
        username: admin.name,
        module,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        ip: req.headers.get('x-forwarded-for') || null,
        ua: req.headers.get('user-agent') || null,
      },
    })
  } catch {
    /* 日志失败不影响主流程 */
  }
}
