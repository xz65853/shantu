import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { fullUrl } from '@/lib/full-url'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

function parseImages(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 项目详情 + 运营报告 + 日报（Bearer 鉴权 + 归属校验，防越权）
 * 报告/日报只读返回，客户无法在小程序修改。
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  return handle(async () => {
    const payload = await getMemberFromRequest(_req)
    if (!payload) return fail('请先登录', 401, 401)

    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        reports: { orderBy: { month: 'desc' } },
        dailyLogs: { orderBy: { workDate: 'desc' } },
      },
    })
    if (!project || project.memberId !== payload.id) return fail('项目不存在', 404)

    return ok({
      id: project.id,
      // 编号兜底：老数据可能为空，与列表接口保持一致（XM + 6 位 id）
      projectNo: project.projectNo || 'XM' + String(project.id).padStart(6, '0'),
      name: project.name,
      packageName: project.packageName,
      serviceDesc: project.serviceDesc,
      manager: project.manager,
      status: project.status,
      startAt: project.startAt,
      endAt: project.endAt,
      // note 为内部备注，不对客户返回
      reports: project.reports.map((r) => ({
        id: r.id,
        month: r.month,
        videos: r.videos,
        lives: r.lives,
        views: r.views,
        newFans: r.newFans,
        leads: r.leads,
        deals: r.deals,
        gmv: r.gmv,
        summary: r.summary,
        nextPlan: r.nextPlan,
        // 相对路径必须转绝对地址，否则小程序 <image> 无法加载
        images: parseImages(r.imagesJson).map(fullUrl),
      })),
      dailyLogs: project.dailyLogs.map((d) => ({
        id: d.id,
        workDate: d.workDate,
        content: d.content,
        videos: d.videos,
        lives: d.lives,
        views: Number(d.views),
        newFans: d.newFans,
        leads: d.leads,
        deals: d.deals,
        gmv: Number(d.gmv),
        summary: d.summary || '',
        images: parseImages(d.imagesJson).map(fullUrl),
      })),
    })
  })
}
