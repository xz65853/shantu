import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { leadCreateSchema } from '@/lib/validators'
import { notifyNewLead } from '@/lib/notify'

// 简易内存限流（同一 IP 60 秒内最多 3 次）
const rateMap = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string) {
  const now = Date.now()
  const item = rateMap.get(ip)
  if (!item || item.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  item.count += 1
  return item.count > 3
}

function clientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = clientIp(req)
    if (rateLimited(ip)) {
      return fail('提交过于频繁，请稍后再试', 429, 429)
    }

    const body = await parseBody(req, leadCreateSchema)

    const lead = await prisma.lead.create({
      data: {
        name: body.name || '未填写',
        phone: body.phone,
        company: body.company || null,
        city: body.city || null,
        industry: body.industry || null,
        requirements: JSON.stringify(body.requirements ?? []),
        message: body.message || null,
        source: body.source || '官网',
        sourcePage: body.sourcePage || null,
      },
    })

    void notifyNewLead({
      name: lead.name,
      phone: lead.phone,
      company: lead.company,
      industry: lead.industry,
      message: lead.message,
      source: lead.source,
    })

    return { id: lead.id }
  })
}
