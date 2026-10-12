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

/** AI 解析项目报表：本月数据点评 + 与上月对比 + 给客户的话术 */
export async function POST(req: Request, ctx: Ctx) {
  const { error, admin } = await guard('projects')
  if (error) return error
  const { id } = await ctx.params
  return handle(async () => {
    const body = await parseBody(req, schema)
    const projectId = Number(id)

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return fail('项目不存在', 404)

    // 本月与上月日报聚合
    const [ym, mm] = body.month.split('-').map(Number)
    const prevMonth = mm === 1 ? `${ym - 1}-12` : `${ym}-${String(mm - 1).padStart(2, '0')}`
    const curPrefix = body.month
    const prevPrefix = prevMonth

    const [curLogs, prevLogs, prevReport] = await Promise.all([
      prisma.projectDailyLog.findMany({ where: { projectId, workDate: { startsWith: curPrefix } } }),
      prisma.projectDailyLog.findMany({ where: { projectId, workDate: { startsWith: prevPrefix } } }),
      prisma.projectReport.findUnique({ where: { projectId_month: { projectId, month: prevMonth } } }),
    ])

    const agg = (logs: typeof curLogs) => ({
      videos: logs.reduce((s, l) => s + num(l.videos), 0),
      lives: logs.reduce((s, l) => s + num(l.lives), 0),
      views: logs.reduce((s, l) => s + num(l.views), 0),
      newFans: logs.reduce((s, l) => s + num(l.newFans), 0),
      leads: logs.reduce((s, l) => s + num(l.leads), 0),
      deals: logs.reduce((s, l) => s + num(l.deals), 0),
      gmv: logs.reduce((s, l) => s + num(l.gmv), 0),
    })
    const cur = agg(curLogs)
    const prevFromLogs = agg(prevLogs)
    const hasPrev = prevReport || prevLogs.length > 0
    const prev = prevReport
      ? {
          videos: prevReport.videos,
          lives: prevReport.lives,
          views: Number(prevReport.views),
          newFans: prevReport.newFans,
          leads: prevReport.leads,
          deals: prevReport.deals,
          gmv: Number(prevReport.gmv),
        }
      : prevFromLogs

    const yuan = (c: number) => (c / 100).toFixed(2)
    const sys = '你是资深抖音代运营顾问，擅长数据分析与客户沟通。输出中文，分三段：一、本月数据点评（指出哪些指标涨/跌）；二、与上月对比分析；三、给客户的话术（可直接发给客户，语气专业、正向、有说服力）。'
    const prevText = hasPrev
      ? `上月(${prevMonth})数据：视频 ${prev.videos}，直播 ${prev.lives}，播放量 ${prev.views}，新粉 ${prev.newFans}，咨询 ${prev.leads}，成交 ${prev.deals}，GMV ${yuan(prev.gmv)} 元。`
      : '暂无上月数据。'
    const user = `项目「${project.name}」本月(${body.month})数据：视频 ${cur.videos}，直播 ${cur.lives}，播放量 ${cur.views}，新粉 ${cur.newFans}，咨询 ${cur.leads}，成交 ${cur.deals}，GMV ${yuan(cur.gmv)} 元。${prevText} 请做点评与话术。`

    const result = await chatCompletion({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      scene: 'report_analysis',
      adminId: admin.id,
      timeoutMs: 60000,
    })

    return ok({ analysis: result.content, model: result.model, tokens: result.totalTokens })
  })
}
