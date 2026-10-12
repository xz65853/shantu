import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok, parseBody } from '@/lib/api'
import { getAiDailyDays, getAiDailyLimit, getAiMaxImages, getAiReportMonths, getAssistantPrompt, saveAssistantPrompt } from '@/lib/ai'

export const dynamic = 'force-dynamic'

/** AI 配置列表（含是否已填 Key，不返回明文 Key 给前端列表？——需求要求可编辑，故返回明文，前端受权限保护） */
export async function GET() {
  const { error } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const list = await prisma.aiProvider.findMany({ orderBy: { sort: 'asc' } })
    const [dailyLimit, reportMonths, dailyDays, maxImages, prompt] = await Promise.all([
      getAiDailyLimit(),
      getAiReportMonths(),
      getAiDailyDays(),
      getAiMaxImages(),
      getAssistantPrompt(),
    ])
    return ok({ list, dailyLimit, reportMonths, dailyDays, maxImages, prompt })
  })
}

const providerSchema = z.object({
  id: z.number().int().positive(),
  enabled: z.boolean().optional(),
  apiKey: z.string().trim().max(255).optional().nullable(),
  apiBase: z.string().trim().max(255).optional().nullable(),
  model: z.string().trim().max(64).optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(100000).optional(),
  isDefault: z.boolean().optional(),
})

const updateSchema = z.object({
  providers: z.array(providerSchema).max(20),
  dailyLimit: z.number().int().min(1).max(9999).optional(),
  reportMonths: z.number().int().min(1).max(24).optional(),
  dailyDays: z.number().int().min(1).max(180).optional(),
  maxImages: z.number().int().min(1).max(30).optional(),
  prompt: z.string().max(10000).optional(),
})

/** 批量保存 AI 配置 */
export async function PUT(req: Request) {
  const { error, admin } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, updateSchema)

    // 先确保唯一默认模型
    const defaultId = body.providers.find((p) => p.isDefault)?.id

    await prisma.$transaction(async (tx) => {
      for (const p of body.providers) {
        const data: Record<string, unknown> = {}
        if (p.enabled !== undefined) data.enabled = p.enabled
        if (p.apiKey !== undefined) data.apiKey = p.apiKey || null
        if (p.apiBase !== undefined) data.apiBase = p.apiBase || null
        if (p.model !== undefined) data.model = p.model || null
        if (p.temperature !== undefined) data.temperature = p.temperature
        if (p.maxTokens !== undefined) data.maxTokens = p.maxTokens
        if (p.isDefault !== undefined) data.isDefault = p.isDefault
        await tx.aiProvider.update({ where: { id: p.id }, data })
      }
      // 清除其他默认标记
      if (defaultId) {
        await tx.aiProvider.updateMany({ where: { id: { not: defaultId } }, data: { isDefault: false } })
      }
    })

    // 保存每日 AI 对话限额（site_settings.ai_daily_limit）
    if (body.dailyLimit !== undefined) {
      await prisma.siteSetting.upsert({
        where: { key: 'ai_daily_limit' },
        update: { value: String(body.dailyLimit) },
        create: { key: 'ai_daily_limit', value: String(body.dailyLimit) },
      })
    }

    // 保存 AI 上下文读取范围：月报期数 / 日报天数 / 截图张数
    const ctxLimits: Array<[string, number | undefined]> = [
      ['ai_report_months', body.reportMonths],
      ['ai_daily_days', body.dailyDays],
      ['ai_max_images', body.maxImages],
    ]
    for (const [key, val] of ctxLimits) {
      if (val === undefined) continue
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) },
      })
    }

    // 保存 AI 数据顾问人设（site_settings.ai_assistant_prompt）
    if (body.prompt !== undefined) {
      await saveAssistantPrompt(body.prompt)
    }

    return ok({}, 'AI 配置已保存')
  })
}
