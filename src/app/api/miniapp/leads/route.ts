import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { leadCreateSchema } from '@/lib/validators'
import { notifyNewLead } from '@/lib/notify'
import { trackConversion } from '@/lib/tencent-ads'

// 简易内存限流（同一 IP 60 秒内最多 5 次）
const rateMap = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string) {
  const now = Date.now()
  const item = rateMap.get(ip)
  if (!item || item.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  item.count += 1
  return item.count > 5
}

function clientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/** 小程序咨询提交（source 固定为 MINIAPP） */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = clientIp(req)
    if (rateLimited(ip)) return fail('提交过于频繁，请稍后再试', 429, 429)

    const body = await parseBody(req, leadCreateSchema)

    // 广告归因：小程序把启动时拿到的 clickid 带上来（普通用户为空）
    const clickid = (body.clickid || '').trim() || null
    const adSource = clickid ? (body.adSource || 'tencent').trim() : null

    const lead = await prisma.lead.create({
      data: {
        name: body.name || '未填写',
        phone: body.phone,
        company: body.company || null,
        city: body.city || null,
        industry: body.industry || null,
        requirements: JSON.stringify(body.requirements ?? []),
        message: body.message || null,
        source: '小程序',
        sourcePage: body.sourcePage || '微信小程序',
        clickid,
        adSource,
      },
    })

    // 回传腾讯广告：留资转化（内部吞异常，不影响留资结果）
    void trackConversion({ clickid, event: 'LEAD', traceId: `lead-${lead.id}` })

    void notifyNewLead({
      name: lead.name,
      phone: lead.phone,
      company: lead.company,
      industry: lead.industry,
      message: lead.message,
      source: lead.source,
    })

    return ok({ id: lead.id }, '咨询提交成功，我们会尽快联系您')
  })
}
