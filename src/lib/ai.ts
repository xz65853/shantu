import { prisma } from './db'
import { FriendlyError } from './api'

/**
 * AI 大模型统一调用层（OpenAI 兼容 chat/completions 接口）。
 * 支持豆包/DeepSeek/通义千问/文心一言/智谱GLM/OpenAI，六家均兼容 OpenAI 格式。
 * 所有调用记录日志（谁、何时、哪个模型、token 消耗、耗时），并做付费/权限校验。
 */

export type AiScene = 'report_summary' | 'report_analysis' | 'assistant' | 'article_write' | 'case_write' | 'dashboard_brief' | 'daily_fill' | 'title_suggest'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContentPart[]
}

type ChatContentPart = {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

type AiCallResult = {
  content: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  durationMs: number
}

/** 小程序 AI 对话默认超时（需求：15 秒，超时提示「网络繁忙」） */
// 历史故障：15s 过短，上游偶发抖动即触发 abort（ai_call_logs 有明确失败记录）。
// 现放宽到 45s，并对网络类错误重试，避免一次抖动中断客户提问。
const DEFAULT_TIMEOUT_MS = 120000

/** 默认每日 AI 对话限额（后台可在「AI 配置」调整，存 site_settings.ai_daily_limit） */
export const DEFAULT_AI_DAILY_LIMIT = 20

/**
 * 固定系统提示词：桃江闪途网络的资深运营顾问（小程序 AI 助手专用）。
 * 回答要求：说人话、给具体建议、不编数据、200 字内分点、不承诺效果。
 */
export const ASSISTANT_SYSTEM_PROMPT = `你是「桃江闪途」的 AI 数据顾问，服务已购买代运营服务的付费客户。你的核心职责是：帮客户看懂运营数据、识别数据问题、解释数据变化、回答关于项目数据和运营效果的问题。

你是客户的「数据解释器 + 数据分析师 + 智能答疑助手」，不是运营执行人员，不是替客户制定每日运营计划的 AI，更不是要求客户自己优化账号的"运营老师"。

【你可以做的事】
1. 识别客户上传的截图：抖音后台/数据中心、账号数据、作品数据、直播数据、千川投流、巨量引擎、广告报表、直播间、商品、订单、客户线索、日报/周报/月报、Excel/数据表格、多张连续截图。
2. 把专业运营数据翻译成客户能听懂的结论。
3. 回答客户关于数据的疑问，并解释原因。

【你绝对不能做的事】
- 不替客户制定执行方案：不主动给下一条视频选题、明天直播方案、投流操作方案、主播话术、拍摄脚本、广告调整方案、账号运营计划。
- 不下"视频质量下降""主播话术有问题""千川投放有问题"这类越过数据的猜测结论。
- 不替公司做虚假宣传：不说"这个月效果非常好""投流肯定有效""马上就会爆""一定赚钱""下月一定增长"，除非数据能证明。

【数据识别必须严谨——这是铁律】
1. 看到图片先识别数据，再确认平台/时间范围/项目/指标/单位，提取关键指标，分析指标关系，最后才回答。不能看到图直接下结论。
2. 数字看不清就明确说看不清，绝不猜、绝不错位（禁止把 1234 认成 1284 再分析）。可以提示客户重新上传清晰截图。
3. 必须区分"事实"与"判断"：事实是"今日消耗 XXX"，判断是"从数据看 ROI 较昨日下降"，推测是"可能与点击成本上升有关"，无法判断就明说"数据不足以判断"。
4. 数据口径冲突时不自行取舍：例如日报成交 1000、千川成交 800，要指出"两份数据口径不同，不能直接合并"，而不是选一个。

【回答格式】
普通数据问题按三段式回答：
- 结论：一句话说清
- 数据：列出关键数据
- 分析：解释数据之间的关系
图片识别后不要只说"图片已识别"，要直接进入分析：说明识别到什么截图、统计周期、核心数据、从数据看出的结论。截图不完整时说明只能分析哪一部分。

【常见问题的分析逻辑】
- 问"为什么数据下降"：按 流量→内容/直播→投放→转化→单日波动还是趋势 五层判断，给出最可能原因+数据依据+能确定的程度。
- 问"投流有没有效果"：从流量效果（曝光/点击/进房）、转化效果（商品点击/咨询/下单/成交）、成本效率（CPC/CPM/CPA/ROI）三个维度判断，不能只看消耗或成交。
- 问"数据正常吗"：建立比较维度（昨日/前3天/前7天/上周同期/上月同期/项目历史）。没有历史数据就明说"只有今天数据，无法判断是否异常"，禁止凭经验说"正常"。
- 问"花了多少钱"：区分日消耗/周消耗/月消耗/累计消耗/广告消耗/服务费用，不混淆。
- 问"是不是投流的问题"：结合数据判断，不简单说"是"或"不是"。

【千川/投放常见指标】
消耗、展现、点击、点击率、CPC、CPM、进房、进房成本、商品点击、商品点击率、加购、下单、支付、成交金额、ROI、转化率、投放成本、千次展现成本。

【抖音后台常见指标】
播放量、播放趋势、完播率、平均观看时长、点赞、评论、分享、收藏、粉丝增长、主页访问、私信、商品点击、转化、视频来源、流量来源。

【直播常见指标】
直播时长、观看人数、进入人数、平均停留、在线人数、互动人数、商品点击/点击率、加购、下单、支付、成交金额、投流消耗、ROI、成交转化率。重点分析"流量→停留→点击→下单→成交"链路。

【与人工运营团队的分工】
你负责：数据识别→整理→分析→问题解释→客户答疑→异常提醒。
人工运营负责：运营策略、内容生产、投流调整、直播执行、实际决策。
所以"怎么优化"这类执行问题，可以简单说明数据指向的问题后，提示"具体运营调整由运营顾问结合实际业务制定"，但不要越俎代庖。

【原则】先识别数据→再理解口径→再建立数据关系→再分析问题→最后回答。不要：看到数据直接猜原因、看到下降就说运营有问题、看到增长就说效果很好、没有数据自己编、看不清自己猜。`
/** 取默认启用的模型；无默认则取第一个启用项；都没有则 null */
export async function getActiveProvider() {
  const all = await prisma.aiProvider.findMany({ where: { enabled: true }, orderBy: [{ isDefault: 'desc' }, { sort: 'asc' }] })
  return all[0] || null
}

/**
 * 取启用的视觉模型 provider（用于多模态图片识别）。
 * 匹配规则：model 或 provider 字段含 'vl' / 'vision' / 'visual' 的启用项，优先 isDefault。
 * 没有则返回 null（此时调用方应回退纯文本，不能传图）。
 */
export async function getVisionProvider() {
  const all = await prisma.aiProvider.findMany({ where: { enabled: true }, orderBy: [{ isDefault: 'desc' }, { sort: 'asc' }] })
  const hit = all.find((p) => {
    const s = `${p.provider} ${p.model || ''}`.toLowerCase()
    return s.includes('vl') || s.includes('vision') || s.includes('visual')
  })
  return hit || null
}

/** 判断会员是否有「已支付」订单（AI 付费门槛） */
export async function hasPaidOrder(memberId: number) {
  const order = await prisma.order.findFirst({
    where: {
      memberId,
      status: { in: ['PAID', 'COMPLETED'] },
      deletedAt: null,
    },
    select: { id: true },
  })
  return Boolean(order)
}

/** 获取每日 AI 对话限额（后台设置，缺省 20） */
export async function getAiDailyLimit(): Promise<number> {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'ai_daily_limit' } })
  const n = Number(row?.value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_AI_DAILY_LIMIT
}

/** 通用：读取 site_settings 中的数字型配置，缺省用 fallback */
async function getAiSettingInt(key: string, fallback: number): Promise<number> {
  const row = await prisma.siteSetting.findUnique({ where: { key } })
  const n = Number(row?.value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** AI 上下文注入的月报期数（默认 6 期） */
export async function getAiReportMonths(): Promise<number> {
  return getAiSettingInt('ai_report_months', 6)
}

/** AI 上下文注入的日报天数（默认 30 天） */
export async function getAiDailyDays(): Promise<number> {
  return getAiSettingInt('ai_daily_days', 30)
}

/** AI 上下文注入的日报/月报截图张数上限（默认 12 张） */
export async function getAiMaxImages(): Promise<number> {
  return getAiSettingInt('ai_max_images', 12)
}

/** 获取 AI 数据顾问人设（system prompt）：优先读后台自定义，缺省用内置默认值 */
export async function getAssistantPrompt(): Promise<string> {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'ai_assistant_prompt' } })
  const v = row?.value?.trim()
  return v ? v : ASSISTANT_SYSTEM_PROMPT
}

/** 保存 AI 数据顾问人设（后台「AI 设置 - 人设管理」调用） */
export async function saveAssistantPrompt(text: string): Promise<void> {
  const value = (text || '').trim()
  await prisma.siteSetting.upsert({
    where: { key: 'ai_assistant_prompt' },
    update: { value },
    create: { key: 'ai_assistant_prompt', value },
  })
}

/** 查询会员当天已调用的 AI 次数（仅统计成功调用，用于限流） */
export async function countAiCallsToday(memberId: number): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return prisma.aiCallLog.count({
    where: { memberId, success: true, createdAt: { gte: start } },
  })
}

/** 记录一次 AI 调用（不抛错，日志失败不影响主流程） */
export async function writeAiLog(params: {
  memberId?: number | null
  adminId?: number | null
  provider: string
  model?: string | null
  scene: AiScene
  prompt?: string | null
  completion?: string | null
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  durationMs?: number
  success: boolean
  error?: string | null
}) {
  try {
    await prisma.aiCallLog.create({
      data: {
        memberId: params.memberId ?? null,
        adminId: params.adminId ?? null,
        provider: params.provider,
        model: params.model ?? null,
        scene: params.scene,
        prompt: params.prompt ?? null,
        completion: params.completion ?? null,
        promptTokens: params.promptTokens ?? 0,
        completionTokens: params.completionTokens ?? 0,
        totalTokens: params.totalTokens ?? 0,
        durationMs: params.durationMs ?? 0,
        success: params.success,
        error: params.error ?? null,
      },
    })
  } catch {
    /* 忽略 */
  }
}

/** 保存一条聊天记录（用户提问或 AI 回复） */
export async function saveChatMessage(params: {
  memberId: number
  role: 'user' | 'assistant'
  content: string
  projectId?: number | null
}) {
  try {
    const msg = await prisma.aiChatMessage.create({
      data: {
        memberId: params.memberId,
        role: params.role,
        content: params.content,
        projectId: params.projectId ?? null,
      },
    })
    return msg
  } catch {
    return null
  }
}

/** 加载某个会员的最近 N 条聊天记录（默认 50 条，按时间升序） */
export async function loadChatHistory(memberId: number, limit = 50) {
  try {
    const list = await prisma.aiChatMessage.findMany({
      where: { memberId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    return list
  } catch {
    return []
  }
}

/** 清空某个会员的全部聊天记录 */
export async function clearChatHistory(memberId: number) {
  try {
    await prisma.aiChatMessage.deleteMany({ where: { memberId } })
    return true
  } catch {
    return false
  }
}

/** 取最近 N 轮对话（user+assistant 成对），用于上下文注入（默认 10 轮） */
export async function getRecentContext(memberId: number, rounds = 10): Promise<ChatMessage[]> {
  try {
    // 取最近 2*rounds 条，确保能凑够 rounds 轮
    const list = await prisma.aiChatMessage.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: rounds * 2,
    })
    // 倒序转正序
    const ordered = list.reverse()
    return ordered.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  } catch {
    return []
  }
}

/**
 * 调用默认模型完成一次对话。
 * - API Key / 模型未配置：抛出「AI 服务升级中，请稍后再试」
 * - 请求超时 / 网络异常 / 上游错误：抛出「网络繁忙，请稍后再试」
 * 技术细节只写入调用日志，不向前端暴露。
 */
/**
 * 火山方舟（豆包）的模型默认开启「深度思考」，同样的问题耗时是普通模式的 5~8 倍
 * （实测：同一个问题 16.6s → 关闭思考后 2.2s）。这里对豆包系模型显式关闭思考。
 */
function buildExtraBody(
  provider: { provider: string; apiBase: string | null },
  model: string,
): Record<string, unknown> {
  const isArk = provider.provider === 'doubao' || (provider.apiBase || '').includes('volces.com')
  const isDoubaoModel = /^(doubao|ep-)/.test(model)
  if (!isArk || !isDoubaoModel) return {}
  return { thinking: { type: 'disabled' } }
}

export async function chatCompletion(params: {
  messages: ChatMessage[]
  scene: AiScene
  memberId?: number | null
  adminId?: number | null
  temperature?: number
  maxTokens?: number
  /** 超时毫秒，缺省 15s（小程序对话）；后台月报/分析可传更长 */
  timeoutMs?: number
  /** 覆盖默认模型（多模态场景传入视觉模型名） */
  model?: string
}): Promise<AiCallResult> {
  const provider = await getActiveProvider()
  if (!provider || !provider.apiKey) {
    await writeAiLog({
      memberId: params.memberId,
      adminId: params.adminId,
      provider: provider?.provider ?? 'unknown',
      scene: params.scene,
      success: false,
      error: 'AI provider not configured or missing apiKey',
    })
    throw new FriendlyError('AI 服务升级中，请稍后再试')
  }

  const base = (provider.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const model = params.model || provider.model || 'gpt-4o-mini'
  const temperature = params.temperature ?? provider.temperature ?? 0.7
  const maxTokens = params.maxTokens ?? provider.maxTokens ?? 2000

  const promptText = params.messages
    .map((m) => {
      const c = Array.isArray(m.content)
        ? m.content
            .map((p) => (p.type === 'text' ? p.text : `[图片:${(p.image_url?.url || '').slice(0, 40)}...]`))
            .join('')
        : m.content
      return `${m.role}: ${c}`
    })
    .join('\n')
  const started = Date.now()

  // 上游偶发抖动会直接 abort 导致整轮对话失败，
  // 这里对网络类错误最多重试 3 次（每次独立计时）。
  const MAX_ATTEMPTS = 3
  let resp: Response | undefined
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: params.messages,
          temperature,
          max_tokens: maxTokens,
          ...buildExtraBody(provider, model),
        }),
        signal: AbortSignal.timeout(params.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      })
      break
    } catch (e) {
      lastErr = e
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[ai] 第 ${attempt} 次调用失败，准备重试：`,
          e instanceof Error ? e.message : e
        )
        await new Promise((r) => setTimeout(r, 500 * attempt))
      }
    }
  }

  if (!resp) {
    const msg = lastErr instanceof Error ? lastErr.message : '请求超时'
    await writeAiLog({
      memberId: params.memberId,
      adminId: params.adminId,
      provider: provider.provider,
      model,
      scene: params.scene,
      prompt: promptText,
      success: false,
      error: msg,
      durationMs: Date.now() - started,
    })
    throw new FriendlyError('网络繁忙，请稍后再试')
  }

  const text = await resp.text()
  if (!resp.ok) {
    await writeAiLog({
      memberId: params.memberId,
      adminId: params.adminId,
      provider: provider.provider,
      model,
      scene: params.scene,
      prompt: promptText,
      success: false,
      error: `HTTP ${resp.status}: ${text.slice(0, 500)}`,
      durationMs: Date.now() - started,
    })
    throw new FriendlyError('网络繁忙，请稍后再试')
  }

  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    await writeAiLog({
      memberId: params.memberId,
      adminId: params.adminId,
      provider: provider.provider,
      model,
      scene: params.scene,
      prompt: promptText,
      success: false,
      error: '响应非 JSON',
      durationMs: Date.now() - started,
    })
    throw new FriendlyError('网络繁忙，请稍后再试')
  }

  const content: string = json?.choices?.[0]?.message?.content ?? ''
  const usage = json?.usage || {}
  const promptTokens = Number(usage.prompt_tokens || 0)
  const completionTokens = Number(usage.completion_tokens || 0)
  const totalTokens = Number(usage.total_tokens || promptTokens + completionTokens)
  const durationMs = Date.now() - started

  await writeAiLog({
    memberId: params.memberId,
    adminId: params.adminId,
    provider: provider.provider,
    model,
    scene: params.scene,
    prompt: promptText,
    completion: content,
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs,
    success: true,
  })

  if (!content) throw new FriendlyError('网络繁忙，请稍后再试')

  return { content, provider: provider.provider, model, promptTokens, completionTokens, totalTokens, durationMs }
}

/**
 * 流式对话：模型每产出一段文字就回调 onDelta，用于小程序「打字机」效果。
 * 非流式要等模型把整段写完才返回，客户端全程干等；流式 1 秒内出首字，体感快很多。
 */
export async function chatCompletionStream(params: {
  messages: ChatMessage[]
  scene: AiScene
  memberId?: number | null
  adminId?: number | null
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  model?: string
  onDelta: (text: string) => void
}): Promise<AiCallResult> {
  const provider = await getActiveProvider()
  if (!provider || !provider.apiKey) throw new FriendlyError('AI 服务升级中，请稍后再试')

  const base = (provider.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const model = params.model || provider.model || 'gpt-4o-mini'
  const temperature = params.temperature ?? provider.temperature ?? 0.7
  const maxTokens = params.maxTokens ?? provider.maxTokens ?? 2000
  const started = Date.now()

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      ...buildExtraBody(provider, model),
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    await writeAiLog({
      memberId: params.memberId,
      adminId: params.adminId,
      provider: provider.provider,
      model,
      scene: params.scene,
      success: false,
      error: `HTTP ${resp.status}: ${text.slice(0, 300)}`,
      durationMs: Date.now() - started,
    })
    throw new FriendlyError('网络繁忙，请稍后再试')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let content = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta || {}
        // 思考型模型的 reasoning_content 不展示，只取正文
        const piece = typeof delta.content === 'string' ? delta.content : ''
        if (piece) {
          content += piece
          params.onDelta(piece)
        }
      } catch {
        /* 忽略无法解析的中间片段 */
      }
    }
  }

  const durationMs = Date.now() - started
  await writeAiLog({
    memberId: params.memberId,
    adminId: params.adminId,
    provider: provider.provider,
    model,
    scene: params.scene,
    completion: content,
    durationMs,
    success: true,
  })

  if (!content) throw new FriendlyError('网络繁忙，请稍后再试')
  return { content, provider: provider.provider, model, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs }
}

/** 测试连接：用指定 provider 发一句 hello（后台「测试连接」按钮，保留可诊断错误信息） */
export async function testConnection(providerId: number) {
  const provider = await prisma.aiProvider.findUnique({ where: { id: providerId } })
  if (!provider) throw new FriendlyError('提供商不存在')
  if (!provider.apiKey) throw new FriendlyError('请先填写 API Key')
  const base = (provider.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const model = provider.model || 'gpt-4o-mini'

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'hello' }],
      temperature: provider.temperature ?? 0.7,
      max_tokens: 20,
    }),
    signal: AbortSignal.timeout(10000),
  })
  const text = await resp.text()
  if (!resp.ok) {
    throw new FriendlyError(`HTTP ${resp.status}: ${text.slice(0, 300)}`)
  }
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new FriendlyError('响应非 JSON')
  }
  const reply = json?.choices?.[0]?.message?.content ?? '(空回复)'
  return { ok: true, model, reply }
}