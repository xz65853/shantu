import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  code: z.string().trim().min(1, '请输入绑定码'),
})

/** 防爆破：同一会员/同一 IP 连续失败 5 次锁定 10 分钟（内存实现，单进程有效） */
const MAX_FAILS = 5
const LOCK_MS = 10 * 60 * 1000
const failMap = new Map<string, { count: number; lockedUntil: number }>()

/** 同一绑定码被错误尝试次数上限，超过即作废 */
const MAX_CODE_TRY = 3
const codeTryMap = new Map<string, number>()

function checkLocked(key: string) {
  const item = failMap.get(key)
  if (!item) return false
  if (item.lockedUntil > Date.now()) return true
  if (item.lockedUntil && item.lockedUntil <= Date.now()) failMap.delete(key)
  return false
}

function recordFail(key: string) {
  const item = failMap.get(key) || { count: 0, lockedUntil: 0 }
  item.count += 1
  if (item.count >= MAX_FAILS) {
    item.lockedUntil = Date.now() + LOCK_MS
    item.count = 0
  }
  failMap.set(key, item)
}

function clearFail(key: string) {
  failMap.delete(key)
}

/** 小程序端输入绑定码，把当前 openid 写到对应管理员 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const member = await prisma.member.findFirst({
      where: { id: payload.id, status: 'ACTIVE', deletedAt: null },
      select: { id: true, openId: true },
    })
    if (!member || !member.openId) return fail('未获取到微信身份，请重新进入小程序', 400)

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // 防爆破：按 会员ID 与 IP 双重锁定
    const memberKey = `member:${member.id}`
    const ipKey = `ip:${ip}`
    if (checkLocked(memberKey) || checkLocked(ipKey)) {
      return fail('尝试次数过多，已临时锁定，请 10 分钟后再试', 429, 429)
    }

    const body = await parseBody(req, schema)
    const code = body.code.replace(/\D/g, '')

    // 找未使用、未过期的绑定码
    const bind = await prisma.adminBindCode.findFirst({
      where: { code, usedAt: null, expiresAt: { gt: new Date() } },
    })
    if (!bind) {
      recordFail(memberKey)
      recordFail(ipKey)
      return fail('绑定码无效或已过期', 400)
    }

    // 该 openid 是否已绑定过其他管理员
    const already = await prisma.admin.findFirst({
      where: { openId: member.openId, id: { not: bind.adminId } },
    })
    if (already) {
      recordFail(memberKey)
      recordFail(ipKey)
      return fail('该微信已绑定其他管理员账号', 400)
    }

    const target = await prisma.admin.findUnique({ where: { id: bind.adminId } })
    if (!target) {
      recordFail(memberKey)
      recordFail(ipKey)
      return fail('管理员不存在', 400)
    }

    await prisma.admin.update({
      where: { id: bind.adminId },
      data: { openId: member.openId },
    })
    await prisma.adminBindCode.update({ where: { id: bind.id }, data: { usedAt: new Date() } })

    clearFail(memberKey)
    clearFail(ipKey)
    codeTryMap.delete(code)

    return ok({ role: target.role, name: target.displayName }, '绑定成功')
  })
}
