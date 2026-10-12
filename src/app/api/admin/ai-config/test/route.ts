import { z } from 'zod'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { testConnection } from '@/lib/ai'

export const dynamic = 'force-dynamic'

const schema = z.object({ id: z.number().int().positive() })

/** 测试连接：发一句 hello 验证 API Key / 地址 / 模型是否可用 */
export async function POST(req: Request) {
  const { error } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)
    const result = await testConnection(body.id)
    return ok(result, '连接成功')
  })
}
