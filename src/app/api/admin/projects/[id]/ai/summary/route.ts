import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { chatCompletion } from '@/lib/ai'

export const dynamic = 'force-dynamic'

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '月份格式应为 YYYY-MM'),
})

type Ctx = { params: Promise<{ id: string }> }

// 日报模型中 views/gmv 等字段为 BigInt，num 需同时接受 bigint（Number(bigint) 合法）
function num(v: number | bigint | string | null | undefined) {
  return Number(v) || 0
}

/** 一键生成月报总结：把当月汇总数据喂给大模型，输出表现总结/亮点/问题/下月建议 */
export async function POST(req: Request, ctx: Ctx) {
  const { error, admin } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const body = await parseBody(req, schema)
    const projectId = Number(id)

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)

    // 从当月日报聚合数据
    const prefix = body.month
    const logs = await prisma.projectDailyLog.findMany({
      where: { projectId, workDate: { startsWith: prefix } },
    })
    const agg = {
      videos: logs.reduce((s, l) => s + num(l.videos), 0),
      lives: logs.reduce((s, l) => s + num(l.lives), 0),
      views: logs.reduce((s, l) => s + num(l.views), 0),
      newFans: logs.reduce((s, l) => s + num(l.newFans), 0),
      leads: logs.reduce((s, l) => s + num(l.leads), 0),
      deals: logs.reduce((s, l) => s + num(l.deals), 0),
      gmv: logs.reduce((s, l) => s + num(l.gmv), 0),
    }

    const sys = '你是资深抖音代运营顾问，擅长用简洁、专业、有洞察的语言撰写运营月报总结。输出用中文，分四段：一、本月表现总结；二、亮点；三、存在问题；四、下月建议。每段用标题+要点，避免空话套话。'
    const user = `项目「${project.name}」${body.month} 月运营数据：发布视频 ${agg.videos} 条，直播 ${agg.lives} 场，总播放量 ${agg.views}，新增粉丝 ${agg.newFans}，咨询 ${agg.leads} 次，成交 ${agg.deals} 单，GMV ${(agg.gmv / 100).toFixed(2)} 元。请据此撰写月度运营总结。`

    const result = await chatCompletion({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      scene: 'report_summary',
      adminId: admin.id,
      timeoutMs: 60000,
    })

    return ok({ summary: result.content, model: result.model, tokens: result.totalTokens })
  })
}
