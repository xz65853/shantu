import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

const dailyLogSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  content: z.string().trim().min(1, '请填写工作内容').max(10000),
  videos: z.number().int().min(0).default(0), // 今日发布视频数
  lives: z.number().int().min(0).default(0), // 今日直播场次
  views: z.number().int().min(0).default(0), // 今日播放量
  newFans: z.number().int().min(0).default(0), // 今日新增粉丝
  leads: z.number().int().min(0).default(0), // 今日咨询数
  deals: z.number().int().min(0).default(0), // 今日成交单数
  gmv: z.number().int().min(0).default(0), // 今日 GMV，单位：分
  summary: z.string().trim().max(5000).optional().default(''), // 文字总结
  images: z.array(z.string().trim().max(500)).max(9).optional().default([]), // 截图 URL 数组，最多 9 张
  dataJson: z.string().trim().max(5000).optional().default(''),
})

function parseImages(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function toDto(log: {
  id: number
  workDate: string
  content: string
  videos: number
  lives: number
  views: bigint
  newFans: number
  leads: number
  deals: number
  gmv: bigint
  summary: string | null
  imagesJson: string | null
  createdAt: Date
}) {
  return {
    id: log.id,
    workDate: log.workDate,
    content: log.content,
    videos: log.videos,
    lives: log.lives,
    views: Number(log.views),
    newFans: log.newFans,
    leads: log.leads,
    deals: log.deals,
    gmv: Number(log.gmv),
    summary: log.summary || '',
    images: parseImages(log.imagesJson),
    dataJson: log.dataJson || null,
    createdAt: log.createdAt,
  }
}

/** 日报列表（按日期倒序） */
export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const projectId = Number(id)
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)
    const logs = await prisma.projectDailyLog.findMany({
      where: { projectId },
      orderBy: { workDate: 'desc' },
    })
    return ok({ logs: logs.map(toDto) })
  })
}

/** 创建/更新某日日报（同一天重复提交则覆盖） */
export async function POST(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const projectId = Number(id)
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)

    const body = await parseBody(req, dailyLogSchema)
    const imagesJson = JSON.stringify(body.images)
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
      imagesJson,
      dataJson: body.dataJson || null,
    }
    const log = await prisma.projectDailyLog.upsert({
      where: { projectId_workDate: { projectId, workDate: body.workDate } },
      create: { projectId, workDate: body.workDate, ...data },
      update: data,
    })
    return ok(toDto(log), '日报已保存')
  })
}

/** 删除日报 ?logId= */
export async function DELETE(req: Request, ctx: Ctx) {
  const { error } = await guard('projects')
  if (error) return error
  await ctx.params
  return handle(async () => {
    const logId = Number(new URL(req.url).searchParams.get('logId') || 0)
    if (!logId) return fail('参数错误', 400)
    await prisma.projectDailyLog.delete({ where: { id: logId } })
    return ok(null, '日报已删除')
  })
}
