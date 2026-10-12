import { cookies } from 'next/headers'
import { ok } from '@/lib/api'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  return ok(null, '已退出登录')
}
