import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { canMiniWrite, getMiniAdmin, writeMiniAdminLog } from '@/lib/mini-admin-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  content: z.string().trim().min(1, '请输入日报内容').max(5000),
  videos: z.number().int().min(0).optional().default(0),
  lives: z.number().int().min(0).optional().default(0),
  views: z.number().int().min(0).optional().default(0),
  newFans: z.number().int().min(0).optional().default(0),
  leads: z.number().int().min(0).optional().default(0),
  deals: z.number().int().min(0).optional().default(0),
  gmv: z.number().int().min(0).optional().default(0),
  summary: z.string().trim().max(5000).optional().default(''),
  images: z.array(z.string()).max(9).optional().default([]),
})

type Ctx = { params: Promise<{ id: string }> }

/** 给项目写日报（文字 + 数据字段 + 最多 9 张图，同日 upsert 覆盖） */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)
  if (!canMiniWrite(admin.role, 'daily')) return fail('该角色无操作权限', 403, 403)

  const { id } = await params
  return handle(async () => {
    const body = await parseBody(req, schema)
    const projectId = Number(id)
    if (!Number.isFinite(projectId)) return fail('参数错误')

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)

    const data = {
      content: body.content,
      videos: body.videos,
      lives: body.lives,
      views: BigInt(body.views ?? 0),
      newFans: body.newFans,
      leads: body.leads,
      deals: body.deals,
      gmv: BigInt(body.gmv ?? 0),
      summary: body.summary,
      imagesJson: JSON.stringify(body.images || []),
    }
    await prisma.projectDailyLog.upsert({
      where: { projectId_workDate: { projectId, workDate: body.workDate } },
      create: { projectId, workDate: body.workDate, ...data },
      update: data,
    })
    await writeMiniAdminLog(admin, req, '项目', 'daily', 'project', projectId)

    return ok({}, '日报已保存')
  })
}
