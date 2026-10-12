import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from './session'

export function hashPassword(raw: string) {
  return bcrypt.hashSync(raw, 10)
}

export function verifyPassword(raw: string, hash: string) {
  try {
    return bcrypt.compareSync(raw, hash)
  } catch {
    return false
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return await verifySessionToken(token)
}

export async function getCurrentAdmin(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session) return null
  const admin = await prisma.admin.findFirst({
    where: { id: session.id, isActive: true },
    select: { id: true, username: true, role: true, displayName: true },
  })
  if (!admin) return null
  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    name: admin.displayName,
  }
}

export async function requireAdmin(): Promise<SessionPayload> {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')
  return admin
}

export type PermissionKey =
  | 'cases'
  | 'services'
  | 'articles'
  | 'media'
  | 'banners'
  | 'leads'
  | 'settings'
  | 'admins'
  | 'forms'
  | 'dashboard'
  // 小程序 / 微信支付配置：含 AppSecret、商户密钥，仅超级管理员可见
  | 'wechat'
  // 套餐管理
  | 'packages'
  // 订单管理（销售需跟进）
  | 'orders'
  // 支付渠道配置：仅超级管理员
  | 'payment'
  // 会员管理（官网 + 小程序统一客户）
  | 'members'
  // 客户项目管理（含月度运营报告）
  | 'projects'
  // 回收站（软删除数据恢复/彻底删除）
  | 'recycle'
  // 登录日志 + 操作日志
  | 'logs'

/** 仅超级管理员可访问的模块（含密钥类配置） */
const SUPER_ONLY: PermissionKey[] = ['wechat', 'payment', 'admins', 'settings', 'recycle', 'logs']

const SALES_ALLOWED: PermissionKey[] = ['leads', 'orders', 'members', 'dashboard']
const OPERATOR_ALLOWED: PermissionKey[] = [
  'cases',
  'services',
  'articles',
  'media',
  'banners',
  'forms',
  'packages',
  'orders',
  'members',
  'projects',
  'dashboard',
]

export function canAccess(role: SessionPayload['role'], key: PermissionKey) {
  if (role === 'SUPER_ADMIN') return true
  if (SUPER_ONLY.includes(key)) return false
  if (role === 'SALES') return SALES_ALLOWED.includes(key)
  // 财务：订单/会员/仪表盘（不看内容与设置）
  if (role === 'FINANCE') return ['orders', 'members', 'dashboard', 'packages'].includes(key)
  // 只读：仅查看类列表（不能改设置/删除）
  if (role === 'READONLY') {
    return ['dashboard', 'leads', 'orders', 'members', 'projects', 'cases', 'services', 'articles', 'media', 'banners', 'forms'].includes(key)
  }
  return OPERATOR_ALLOWED.includes(key)
}

export async function requirePermission(key: PermissionKey): Promise<SessionPayload> {
  const admin = await requireAdmin()
  if (!canAccess(admin.role, key)) redirect('/admin')
  return admin
}
