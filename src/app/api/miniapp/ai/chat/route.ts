import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { fullUrl } from '@/lib/full-url'
import {
  chatCompletion,
  chatCompletionStream,
  countAiCallsToday,
  getAiDailyDays,
  getAiDailyLimit,
  getAiMaxImages,
  getAiReportMonths,
  getAssistantPrompt,
  getRecentContext,
  hasPaidOrder,
  saveChatMessage,
  type ChatMessage,
} from '@/lib/ai'

export const dynamic = 'force-dynamic'

const schema = z.object({
  message: z.string().trim().min(1, '请输入问题').max(2000),
  imagePath: z.string().max(500).optional(),
  imageMime: z.string().max(100).optional(),
  /** 流式返回：边生成边输出纯文本，供小程序「打字机」渲染 */
  stream: z.boolean().optional(),
})

const PROJECT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待开始',
  RUNNING: '进行中',
  PAUSED: '已暂停',
  DONE: '已完成',
}

function num(v: number | bigint | string | null | undefined) {
  return Number(v) || 0
}

function fmtDate(v: Date | string | null | undefined): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') return v.slice(0, 10)
  return null
}

/** 校验图片路径合法性，杜绝目录穿越，仅允许 ai-chat 目录下的文件 */
function safeImagePath(p: string): string | null {
  if (!p.startsWith('/uploads/ai-chat/')) return null
  if (p.includes('..')) return null
  const name = p.slice('/uploads/ai-chat/'.length)
  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) return null
  return path.join('/www/wwwroot/shantu-web', 'uploads', 'ai-chat', name)
}

/** 把本地图片读成 base64 data URL（喂给视觉模型） */
async function imageToDataUrl(localPath: string, mime: string): Promise<string | null> {
  try {
    const full = safeImagePath(localPath)
    if (!full) return null
    const buf = await readFile(full)
    if (buf.length > 5 * 1024 * 1024) return null
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/** 历史消息 content 可能存的是 JSON（带图片），还原为多模态结构 */
function parseHistoryContent(raw: string): string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> {
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw)
      if (obj && obj.type === 'image' && obj.text) {
        // 历史里的图片用 URL（走 nginx 直链），但视觉模型需要可访问 URL 或 base64。
        // 这里简化：历史图片在本次上下文里只保留文本说明，不重复传图（避免过期链接）。
        return obj.text
      }
    } catch {
      /* 回落为纯文本 */
    }
  }
  return raw
}

/** 解析日报/月报的截图 JSON 数组（imagesJson → string[]） */
function parseImages(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 小程序 AI 助手（客户用）：
 * 1. 仅名下有「已支付」订单的用户可用，否则 403 提示购买
 * 2. 每次请求注入客户数据上下文（姓名/套餐/本月数据/最近3天日报/项目状态）
 * 3. 注入最近 10 轮对话作为上下文，让 AI 知道前面聊过什么
 * 4. 付费用户每天限 N 次（后台可调，默认 20），超出提示联系顾问
 * 5. 支持图片消息：客户上传截图，后端读图转 base64 喂给视觉模型识别
 * 6. 每次提问 + AI 回复都持久化到数据库
 */
export async function POST(req: Request) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    // 后台开关：关闭时拒绝
    const switchRow = await prisma.siteSetting.findUnique({ where: { key: 'mini_ai_enabled' } })
    if (switchRow?.value === '0') {
      return fail('AI功能维护中，暂未开放', 403, 403)
    }

    // 付费校验
    const paid = await hasPaidOrder(payload.id)
    if (!paid) {
      return fail('AI 分析功能仅对已签约客户开放，立即咨询套餐获取专属顾问服务', 403, 403)
    }

    // 速率限制
    const limit = await getAiDailyLimit()
    const used = await countAiCallsToday(payload.id)
    if (used >= limit) {
      return fail('今日 AI 咨询已达上限，明天再来或联系运营顾问', 429, 429)
    }

    const body = await parseBody(req, schema)

    // 会员基础信息
    const member = await prisma.member.findUnique({
      where: { id: payload.id },
      select: { name: true, nickname: true, phone: true },
    })

    // 项目 + 月报 + 日报（期数/天数/截图张数由后台「AI 配置」可调）
    const [reportMonths, dailyDays, maxImages] = await Promise.all([
      getAiReportMonths(),
      getAiDailyDays(),
      getAiMaxImages(),
    ])
    const projects = await prisma.project.findMany({
      where: { memberId: payload.id },
      orderBy: { id: 'asc' },
      include: {
        reports: { orderBy: { month: 'desc' }, take: reportMonths },
        dailyLogs: { orderBy: { workDate: 'desc' }, take: dailyDays },
      },
    })

    if (projects.length === 0) {
      return ok({
        reply: '您暂时还没有服务项目数据。如有疑问，请联系您的运营顾问。',
        model: null,
        remaining: Math.max(0, limit - used - 1),
      })
    }

    // 处理图片：读取本地文件转 base64 data URL
    let imageDataUrl: string | null = null
    if (body.imagePath) {
      imageDataUrl = await imageToDataUrl(body.imagePath, body.imageMime || 'image/png')
      if (!imageDataUrl) {
        return fail('图片读取失败，请重新上传', 400, 400)
      }
    }

    // 保存用户提问（带图片则存 JSON 记录）
    const userContentRaw = imageDataUrl
      ? JSON.stringify({ type: 'image', text: body.message, imagePath: body.imagePath })
      : body.message
    await saveChatMessage({
      memberId: payload.id,
      role: 'user',
      content: userContentRaw,
    })

    // 构造数据上下文
    const ctxParts: string[] = []
    ctxParts.push(`客户姓名：${member?.name || member?.nickname || member?.phone || '未填写'}`)

    // 收集日报/月报里的后台截图，让模型能直接"看"到数据图（最新优先，去重，上限可调）
    const contextImages: string[] = []
    const MAX_CTX_IMAGES = maxImages
    const pushImages = (json: string | null | undefined) => {
      if (contextImages.length >= MAX_CTX_IMAGES) return
      for (const raw of parseImages(json)) {
        if (contextImages.length >= MAX_CTX_IMAGES) break
        const url = fullUrl(raw)
        if (url && !contextImages.includes(url)) contextImages.push(url)
      }
    }

    for (const p of projects) {
      const lines = [`项目「${p.name}」（当前状态：${PROJECT_STATUS_LABEL[p.status] || p.status}）`]
      if (p.packageName) lines.push(`套餐类型：${p.packageName}`)
      if (p.startAt || p.endAt) {
        const s = fmtDate(p.startAt) || '未定'
        const e = fmtDate(p.endAt) || '未定'
        lines.push(`服务周期：${s} 至 ${e}`)
      }
      if (p.manager) lines.push(`负责人：${p.manager}`)

      // 月报：全部（最多 6 期），从新到旧，含数据/总结/下月计划
      if (p.reports.length) {
        const rpt = p.reports.map((r) => {
          const parts = [
            `${r.month}：视频 ${r.videos}，直播 ${r.lives}，播放量 ${num(r.views)}，新粉丝 ${num(r.newFans)}，咨询 ${num(r.leads)}，成交 ${num(r.deals)}，GMV ${(num(r.gmv) / 100).toFixed(2)} 元`,
          ]
          if (r.summary) parts.push(`总结：${r.summary}`)
          if (r.nextPlan) parts.push(`下月计划：${r.nextPlan}`)
          return parts.join('；')
        })
        lines.push(`月报汇总（${p.reports.length} 期，从新到旧）：${rpt.join(' || ')}`)
        for (const r of p.reports) pushImages(r.imagesJson)
      }

      // 日报：全部（最多 30 天），从新到旧，含文字 + 关键数据
      if (p.dailyLogs.length) {
        const brief = p.dailyLogs
          .map((l) => {
            const txt = (l.summary || l.content || '').slice(0, 50)
            const metrics = `播放${num(l.views)}/咨询${num(l.leads)}/成交${num(l.deals)}/GMV${(num(l.gmv) / 100).toFixed(0)}元`
            return `${l.workDate.slice(5).replace('-', '/')}：${txt}（${metrics}）`
          })
          .join('；')
        lines.push(`日报（最近 ${p.dailyLogs.length} 天）：${brief}`)
        for (const l of p.dailyLogs) pushImages(l.imagesJson)
      }
      ctxParts.push(lines.join('；'))
    }

    if (contextImages.length) {
      ctxParts.push(`（另附最近日报/月报的后台数据截图 ${contextImages.length} 张，请直接读取截图中的直播大屏/千川投流/成交等数据作答，不要只说"没有数据"）`)
    }

    // 注入最近 10 轮对话上下文
    const recentContext = await getRecentContext(payload.id, 10)
    const contextLines: string[] = []
    if (recentContext.length > 0) {
      contextLines.push('【之前的对话历史】')
      for (const m of recentContext) {
        const speaker = m.role === 'user' ? '客户' : 'AI'
        const c = typeof m.content === 'string' ? parseHistoryContent(m.content) : m.content
        const text = Array.isArray(c) ? c.map((p) => (p.type === 'text' ? p.text : '[图片]')).join('') : c
        contextLines.push(`${speaker}：${text}`)
      }
      contextLines.push('【以上是历史对话，下面是当前问题】')
    }

    const userText = `客户当前项目数据：
${ctxParts.join('\n')}

${contextLines.join('\n')}

客户问题：${body.message}`

    // 组装最终 user 消息：文本 + 聊天图片 + 日报/月报截图（多模态）
    const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { type: 'text', text: userText },
    ]
    if (imageDataUrl) contentParts.push({ type: 'image_url', image_url: { url: imageDataUrl } })
    for (const url of contextImages) contentParts.push({ type: 'image_url', image_url: { url } })
    const userMessage: ChatMessage =
      contentParts.length === 1
        ? { role: 'user', content: userText }
        : { role: 'user', content: contentParts }

    const systemPrompt = await getAssistantPrompt()
    const remainingAfter = Math.max(0, limit - used - 1)

    // 流式模式：返回纯文本分块，小程序端边收边渲染
    if (body.stream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            const result = await chatCompletionStream({
              messages: [
                { role: 'system', content: systemPrompt },
                userMessage,
              ],
              scene: 'assistant',
              memberId: payload.id,
              maxTokens: 800,
              onDelta: (t) => controller.enqueue(encoder.encode(t)),
            })
            await saveChatMessage({
              memberId: payload.id,
              role: 'assistant',
              content: result.content,
            })
          } catch {
            controller.enqueue(encoder.encode('\n[生成失败，请稍后重试]'))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          // 关掉 nginx 缓冲，否则分块会被攒成一整块，流式就白做了
          'X-Accel-Buffering': 'no',
          'X-Remaining': String(remainingAfter),
        },
      })
    }

    const result = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        userMessage,
      ],
      scene: 'assistant',
      memberId: payload.id,
      maxTokens: 800,
    })

    // 保存 AI 回复
    await saveChatMessage({
      memberId: payload.id,
      role: 'assistant',
      content: result.content,
    })

    return ok({
      reply: result.content,
      model: result.model,
      remaining: Math.max(0, limit - used - 1),
    })
  })
}
