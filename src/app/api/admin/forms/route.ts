import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { formOptionSchema } from '@/lib/validators'

export async function POST(req: Request) {
  const { error } = await guard('forms')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, formOptionSchema)
    const item = await prisma.formOption.create({
      data: {
        group: body.group,
        label: body.label,
        value: body.value || body.label,
        sort: body.sort,
        isActive: body.isActive ?? true,
      },
    })
    return ok({ id: item.id }, '选项已添加')
  })
}
