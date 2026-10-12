import { guard, handle, ok, parseBody } from '@/lib/api'
import { settingsSchema } from '@/lib/validators'
import { saveSettings } from '@/lib/settings'

export async function POST(req: Request) {
  const { error } = await guard('settings')
  if (error) return error

  return handle(async () => {
    const body = await parseBody(req, settingsSchema)
    await saveSettings(body)
    return ok(null, '设置已保存')
  })
}
