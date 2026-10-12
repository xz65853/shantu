import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { generateBizNo } from '@/lib/orderNo'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { notifyNewLead } from '@/lib/notify'

const schema = z.object({
  name: z.string().trim().min(1, '请填写姓名').max(20),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请填写正确的手机号'),
  city: z.string().trim().max(20).optional().default(''),
  industry: z.string().trim().max(20).optional().default(''),
  description: z.string().trim().min(1, '请描述您的需求').max(500),
  images: z.array(z.string().max(500)).max(3).optional().default([]),
})


/** 小程序：提交定制服务需求，生成定制订单（待顾问报价） */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = clientIp(req)
    if (rateLimited(`custom-order:${ip}`, 5, 60_000)) return fail('提交过于频繁，请稍后再试', 429, 429)

    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)
    const member = await prisma.member.findFirst({ where: { id: payload.id, status: 'ACTIVE' } })
    if (!member) return fail('登录状态已失效', 401, 401)

    const body = await parseBody(req, schema)

    const order = await prisma.order.create({
      data: {
        orderNo: await generateBizNo('order', member.userId),
        type: 'CUSTOM',
        customStatus: 'QUOTING',
        packageName: '定制服务',
        period: '面议',
        amount: 0,
        serviceContent: body.description,
        status: 'PENDING',
        memberId: member.id,
        name: body.name,
        phone: body.phone,
        city: body.city || null,
        industry: body.industry || null,
        remark: JSON.stringify({ images: body.images }),
        source: 'MINIAPP-CUSTOM',
      },
    })

    void notifyNewLead({ name: body.name, phone: body.phone, industry: body.industry, message: body.description, source: '定制服务' })

    return ok({ orderNo: order.orderNo })
  })
}
