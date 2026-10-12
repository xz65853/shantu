import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { formOptionSchema } from '@/lib/validators'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await guard('forms')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const body = await parseBody(req, formOptionSchema)
    const oid = Number(id)
    if (!Number.isFinite(oid)) return fail('参数错误')

    await prisma.formOption.update({
      where: { id: oid },
      data: {
        group: body.group,
        label: body.label,
        value: body.value || body.label,
        sort: body.sort,
        isActive: body.isActive ?? true,
      },
    })
    return ok(null, '选项已更新')
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await guard('forms')
  if (error) return error
  const { id } = await params

  return handle(async () => {
    const oid = Number(id)
    if (!Number.isFinite(oid)) return fail('参数错误')
    await prisma.formOption.delete({ where: { id: oid } })
    return ok(null, '选项已删除')
  })
}
