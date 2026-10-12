import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { verifyMemberToken } from '@/lib/member-auth'
import { createSessionToken, SESSION_COOKIE } from '@/lib/session'
import { getClientIp, logLogin } from '@/lib/admin-log'

export const dynamic = 'force-dynamic'

/**
 * 小程序 WebView 免登录入口：
 * 小程序端跳转到 /admin/m?token=<member JWT>&to=/admin/xxx
 * 校验 member token → 会员 openId → admins.open_id 白名单（且 isActive）
 * 成功则生成 admin session cookie，302 跳转到目标后台页（URL 不残留 token）。
 * token 不写入日志，只在内存校验。
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''
  const to = url.searchParams.get('to') || '/admin'

  // 目标路径白名单：仅允许 /admin 前缀，防开放重定向
  let target = '/admin'
  if (to && to.startsWith('/admin') && !to.startsWith('/admin/m') && !to.includes('//')) {
    target = to
  }

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent') || ''

  // 构造基于外部 Host 的跳转 URL（nginx 反代后 req.url 是内网地址）
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || ''
  const baseUrl = `${proto}://${host}`

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', baseUrl))
  }

  // 1) 校验 member token
  const member = await verifyMemberToken(token)
  if (!member) {
    return NextResponse.redirect(new URL('/admin/login', baseUrl))
  }

  // 2) 找会员 openId（需有效会员）
  const m = await prisma.member.findFirst({
    where: { id: member.id, status: 'ACTIVE', deletedAt: null },
    select: { id: true, openId: true },
  })
  if (!m || !m.openId) {
    return NextResponse.redirect(new URL('/admin/login', baseUrl))
  }

  // 3) 匹配管理员白名单
  const admin = await prisma.admin.findFirst({
    where: { openId: m.openId, isActive: true },
  })
  if (!admin) {
    return NextResponse.redirect(new URL('/admin/login', baseUrl))
  }

  // 4) 生成 admin session cookie
  const sessionToken = await createSessionToken({
    id: admin.id,
    username: admin.username,
    role: admin.role,
    name: admin.displayName,
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: proto === 'https',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  // 记录登录（不记录 token 明文）
  await logLogin({ adminId: admin.id, username: admin.username, ip, ua, status: 'success' })
  await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }).catch(() => {})

  return NextResponse.redirect(new URL(target, baseUrl))
}
