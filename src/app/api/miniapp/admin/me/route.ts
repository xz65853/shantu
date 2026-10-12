import { NextRequest } from 'next/server'
import { fail, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'

export const dynamic = 'force-dynamic'

/** 当前登录管理员信息（手机端「我的」） */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  return ok({ name: admin.name, role: admin.role, phone: admin.phone, adminId: admin.adminId })
}
