import { NextRequest } from 'next/server'
import { z } from 'zod'
import { guard, handle, ok, parseBody } from '@/lib/api'
import { generateContractContentByAI } from '@/lib/contract-ai'

const schema = z.object({
  serviceType: z.string().trim().min(1, '请填写服务类型').max(60),
  packageName: z.string().trim().max(60).optional().default(''),
  requirements: z.string().trim().max(2000).optional().default(''),
})

/** AI 生成合同正文（占位符变量保持不变，可直接保存为模板） */
export async function POST(req: NextRequest) {
  const { error } = await guard('packages')
  if (error) return error
  return handle(async () => {
    const body = await parseBody(req, schema)
    const contentHtml = await generateContractContentByAI({
      serviceType: body.serviceType,
      packageName: body.packageName,
      requirements: body.requirements,
    })
    return ok({ contentHtml })
  })
}
