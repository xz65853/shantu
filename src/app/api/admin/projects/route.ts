import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { genProjectNo } from '@/lib/orderNo'

const projectSchema = z.object({
  name: z.string().trim().min(1, '请填写项目名称').max(60),
  memberId: z.number().int().positive('请选择客户'),
  orderId: z.number().int().positive().optional().nullable(),
  packageName: z.string().trim().max(60).optional().default(''),
  serviceDesc: z.string().trim().max(2000).optional().default(''),
  manager: z.string().trim().max(20).optional().default(''),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'RUNNING', 'PAUSED', 'DONE']).default('PENDING'),
  note: z.string().trim().max(2000).optional().default(''),
})

/** 项目列表（支持 ?memberId= 过滤） */
export async function GET(req: Request) {
  const { error } = await guard('projects')
  if (error) return error
  return handle(async () => {
    const url = new URL(req.url)
    const memberId = Number(url.searchParams.get('memberId') || 0)
    const list = await prisma.project.findMany({
      where: memberId ? { memberId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, userId: true, name: true, nickname: true, realName: true, phone: true } },
        _count: { select: { reports: true } },
      },
    })
    return ok({ list })
  })
}

/** 创建项目 */
export async function POST(req: Request) {
  const { error } = await guard('projects')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, projectSchema)
    const project = await prisma.project.create({
      data: {
        name: body.name,
        memberId: body.memberId,
        orderId: body.orderId || null,
        packageName: body.packageName || null,
        serviceDesc: body.serviceDesc || null,
        manager: body.manager || null,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        status: body.status,
        note: body.note || null,
      },
    })
    // 用自增 id 回填项目编号（XM + 6 位）
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { projectNo: genProjectNo(project.id) },
    })
    return ok(updated, '项目已创建')
  })
}
