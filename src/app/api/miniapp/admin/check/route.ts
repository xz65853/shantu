import { NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'

export const dynamic = 'force-dynamic'

/** 小程序「我的」onShow 时校验：当前 openid 是否是启用状态的管理员 */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) {
    return ok({ isAdmin: false, role: '' })
  }
  return ok({ isAdmin: true, role: admin.role, name: admin.name })
}
