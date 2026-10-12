import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'

export const runtime = 'nodejs'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 小程序 AI 顾问图片上传：客户上传千川/抖音后台/日报截图。
 * 存 uploads/ai-chat/，返回服务端本地路径（后续 chat 接口据此读文件转 base64 喂给视觉模型）。
 */
export async function POST(req: Request) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file || typeof file === 'string') return fail('请选择图片')
    if (!TYPES.includes(file.type)) return fail('仅支持 jpg/png/webp 图片')
    if (file.size > MAX_SIZE) return fail('图片不能超过 5MB')

    const buf = Buffer.from(await file.arrayBuffer())
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
    if (!isJpg && !isPng && !isWebp) return fail('图片内容无效')

    const ext = isPng ? '.png' : isWebp ? '.webp' : '.jpg'
    const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg'
    const dir = path.join('/www/wwwroot/shantu-web', 'uploads', 'ai-chat')
    await mkdir(dir, { recursive: true })
    const name = `m${payload.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    await writeFile(path.join(dir, name), buf)

    // 返回：本地路径（相对 uploads）、mime、用于小程序端展示的直链
    const settings = await import('@/lib/settings')
    const s = await settings.getSettings()
    const base = (s.wxapp_api_base || '').replace(/\/+$/, '')
    const publicUrl = base ? `${base}/uploads/ai-chat/${name}` : `/uploads/ai-chat/${name}`

    return ok({
      localPath: `/uploads/ai-chat/${name}`,
      mime,
      url: publicUrl,
    })
  })
}
