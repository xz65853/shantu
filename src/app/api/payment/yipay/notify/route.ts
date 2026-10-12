import { NextRequest } from 'next/server'
import { handleNotify } from '@/lib/payment/PaymentService'

/**
 * 易支付异步通知（GET / POST）
 * 验签 + 幂等改单；返回纯文本 success / fail（易支付要求，不能返回 JSON）。
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    params[k] = v
  })

  const out = await handleNotify('YIPAY', params)
  return new Response(out.ok ? 'success' : `fail:${out.reason || 'error'}`, { status: 200 })
}

export async function POST(req: NextRequest) {
  const params: Record<string, string> = {}
  try {
    const form = await req.formData()
    form.forEach((v, k) => {
      if (typeof v === 'string') params[k] = v
    })
  } catch {
    /* 忽略 */
  }
  const out = await handleNotify('YIPAY', params)
  return new Response(out.ok ? 'success' : `fail:${out.reason || 'error'}`, { status: 200 })
}
