import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { adminSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await guard('admins')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, adminSchema)
    const aid = Number(id)
    if (!Number.isFinite(aid)) return fail('参数错误')

    const dup = await prisma.admin.findFirst({ where: { username: body.username, id: { not: aid } } })
    if (dup) throw new Error('账号已存在')

    await prisma.admin.update({
      where: { id: aid },
      data: {
        username: body.username,
        displayName: body.displayName,
        role: body.role,
        isActive: body.isActive ?? true,
        phone: body.phone || null,
        remark: body.remark || null,
        ...(body.password ? { passwordHash: hashPassword(body.password) } : {}),
      },
    })
    return ok(null, '管理员已更新')
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { admin, error } = await guard('admins')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const aid = Number(id)
    if (!Number.isFinite(aid)) return fail('参数错误')
    if (admin && admin.id === aid) return fail('不能删除当前登录账号')
    await prisma.admin.delete({ where: { id: aid } })
    return ok(null, '管理员已删除')
  })
}
