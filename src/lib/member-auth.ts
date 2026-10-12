import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

/**
 * 会员会话：官网走 Cookie，小程序走 Authorization: Bearer <token>
 * 与管理员会话（session.ts）相互独立
 */

export const MEMBER_COOKIE = 'shantu_member_token'

export type MemberPayload = {
  id: number
  type: 'WEB' | 'MINI'
  phone: string
  name: string
}

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) {
    throw new Error('[member-auth] AUTH_SECRET 未配置，拒绝使用弱密钥')
  }
  return new TextEncoder().encode(`${s}:member`)
}

export async function createMemberToken(payload: MemberPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyMemberToken(token: string): Promise<MemberPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload || typeof payload.id !== 'number') return null
    return {
      id: payload.id as number,
      type: (payload.type as MemberPayload['type']) ?? 'WEB',
      phone: String(payload.phone ?? ''),
      name: String(payload.name ?? ''),
    }
  } catch {
    return null
  }
}

/** 从 Cookie 或 Bearer 中解析会员身份（未登录返回 null，不抛错） */
export async function getMemberFromRequest(req: Request): Promise<MemberPayload | null> {
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    return await verifyMemberToken(auth.slice(7).trim())
  }
  const store = await cookies()
  const token = store.get(MEMBER_COOKIE)?.value
  if (!token) return null
  return await verifyMemberToken(token)
}

/** 服务端组件用：仅 Cookie */
export async function getCurrentMember(): Promise<MemberPayload | null> {
  const store = await cookies()
  const token = store.get(MEMBER_COOKIE)?.value
  if (!token) return null
  return await verifyMemberToken(token)
}

/** 会员密码：bcrypt 哈希 / 校验 */
export function hashMemberPassword(raw: string) {
  return bcrypt.hashSync(raw, 10)
}

export function verifyMemberPassword(raw: string, hash: string | null | undefined) {
  if (!hash) return false
  try {
    return bcrypt.compareSync(raw, hash)
  } catch {
    return false
  }
}

/** 会员ID：ST + 6 位数字（由数据库自增 id 直接映射，保证唯一可读，如 id=1 -> ST000001） */
export function genMemberUserId(id: number) {
  return `ST${String(id).padStart(6, '0')}`
}

/** 按账号查找会员：支持手机号 或 会员ID（忽略大小写） */
export async function findMemberByAccount(account: string) {
  const raw = account.trim()
  if (!raw) return null
  if (/^1[3-9]\d{9}$/.test(raw)) {
    let byPhone = await prisma.member.findFirst({ where: { phone: raw, deletedAt: null } })
    // 手机号属于已被合并的子账号时，跳到主账号
    if (byPhone?.mergedInto) {
      const primary = await prisma.member.findUnique({ where: { id: byPhone.mergedInto } })
      if (primary) byPhone = primary
    }
    if (byPhone) return byPhone
  }
  return await prisma.member.findFirst({
    where: { userId: { equals: raw.toUpperCase() }, deletedAt: null },
  })
}

/** 校验会员仍有效（未拉黑） */
export async function getActiveMember(req: Request) {
  const payload = await getMemberFromRequest(req)
  if (!payload) return null
  const member = await prisma.member.findFirst({
    where: { id: payload.id, status: 'ACTIVE' },
  })
  if (!member) return null
  return { payload, member }
}
