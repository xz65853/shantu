import { guard, handle, ok, parseBody } from '@/lib/api'
import { settingsSchema } from '@/lib/validators'
import {
  PAY_KEYS,
  getPaymentSettingsMasked,
  savePaymentSettings,
} from '@/lib/payment-settings'

export async function GET() {
  const { error } = await guard('payment')
  if (error) return error

  return handle(async () => {
    const settings = await getPaymentSettingsMasked()
    return ok(settings)
  })
}

export async function POST(req: Request) {
  const { error } = await guard('payment')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, settingsSchema)
    const payload: Record<string, string> = {}
    for (const [key, value] of Object.entries(body)) {
      if (PAY_KEYS.includes(key)) payload[key] = value
    }
    await savePaymentSettings(payload)
    return ok(null, '支付设置已保存')
  })
}
