import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { fail, handle, parseBody } from '@/lib/api'
import { loginSchema } from '@/lib/validators'
import { verifyPassword } from '@/lib/auth'
import { createSessionToken, SESSION_COOKIE } from '@/lib/session'
import { getClientIp, logLogin } from '@/lib/admin-log'
import { notifyLoginAlert } from '@/lib/notify'

/** 登录防爆破：同一 IP+账号 失败 5 次锁定 10 分钟（内存实现，单进程有效） */
const MAX_FAILS = 5
const LOCK_MS = 10 * 60 * 1000
const failMap = new Map<string, { count: number; lockedUntil: number }>()

/** 同 IP 1 分钟内失败时间戳（用于登录异常告警） */
const ipFailMap = new Map<string, number[]>()

function recordIpFail(ip: string): number {
  const now = Date.now()
  const arr = (ipFailMap.get(ip) || []).filter((t) => now - t < 60_000)
  arr.push(now)
  ipFailMap.set(ip, arr)
  return arr.length
}

function loginKey(req: Request, username: string) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  return `${ip}:${username}`
}

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

export async function POST(req: Request) {
  return handle(async () => {
    // 是否 HTTPS（Nginx 反代时看 x-forwarded-proto），HTTP 站点下不能给 Cookie 加 Secure
    const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')
    const isHttps = proto === 'https'

    const body = await parseBody(req, loginSchema)
    const key = loginKey(req, body.username)

    if (checkLocked(key)) {
      return fail('尝试次数过多，账号已临时锁定，请 10 分钟后再试', 429, 429)
    }

    const admin = await prisma.admin.findFirst({
      where: { username: body.username, isActive: true },
    })

    const ip = getClientIp(req)
    const ua = req.headers.get('user-agent') || ''

    if (!admin) {
      recordFail(key)
      await logLogin({ username: body.username, ip, ua, status: 'fail', failReason: '用户不存在或已禁用' })
      if (recordIpFail(ip) === 5) await notifyLoginAlert({ ip, username: body.username, failCount: 5 })
      return fail('账号或密码错误', 401, 401)
    }
    if (!verifyPassword(body.password, admin.passwordHash)) {
      recordFail(key)
      await logLogin({ adminId: admin.id, username: body.username, ip, ua, status: 'fail', failReason: '密码错误' })
      if (recordIpFail(ip) === 5) await notifyLoginAlert({ ip, username: body.username, failCount: 5 })
      return fail('账号或密码错误', 401, 401)
    }
    failMap.delete(key)
    await logLogin({ adminId: admin.id, username: body.username, ip, ua, status: 'success' })

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    })

    const token = await createSessionToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      name: admin.displayName,
    })

    const store = await cookies()
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      code: 0,
      message: '登录成功',
      data: { id: admin.id, role: admin.role, name: admin.displayName },
    })
  })
}
