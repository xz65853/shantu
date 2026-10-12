import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { adminSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/auth'

export async function POST(req: Request) {
  const { error } = await guard('admins')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, adminSchema)
    if (!body.password) throw new Error('请设置初始密码')

    const dup = await prisma.admin.findUnique({ where: { username: body.username } })
    if (dup) throw new Error('账号已存在')

    const item = await prisma.admin.create({
      data: {
        username: body.username,
        passwordHash: hashPassword(body.password),
        displayName: body.displayName,
        role: body.role,
        isActive: body.isActive ?? true,
        phone: body.phone || null,
        remark: body.remark || null,
      },
    })
    return ok({ id: item.id }, '管理员已创建')
  })
}
