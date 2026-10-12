import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok } from '@/lib/api'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 解绑管理员的微信（清空 openid），解绑后小程序端立即失去管理入口 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { error } = await guard('admins')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const aid = Number(id)
    if (!Number.isFinite(aid)) return fail('参数错误')
    await prisma.admin.update({ where: { id: aid }, data: { openId: null } })
    return ok(null, '已解绑微信')
  })
}
