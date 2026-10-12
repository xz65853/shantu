import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fail, handle, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const TYPES = ['image/jpeg', 'image/png']

/** 手机端管理后台图片上传（日报/月报截图）：仅管理员，jpg/png ≤5MB */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await getMiniAdmin(req)
    if (!admin) return fail('您没有权限访问', 403, 403)

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file || typeof file === 'string') return fail('请选择图片')
    if (!TYPES.includes(file.type)) return fail('仅支持 jpg/png 图片')
    if (file.size > MAX_SIZE) return fail('图片不能超过 5MB')

    const buf = Buffer.from(await file.arrayBuffer())
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    if (!isJpg && !isPng) return fail('图片内容无效')

    const ext = isPng ? '.png' : '.jpg'
    const dir = path.join('/www/wwwroot/shantu-web', 'uploads', 'project-daily')
    await mkdir(dir, { recursive: true })
    const name = `a${admin.adminId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`
    await writeFile(path.join(dir, name), buf)

    const settings = await getSettings()
    const base = (settings.wxapp_api_base || '').replace(/\/+$/, '')
    const url = `${base}/api/files/project-daily/${name}`
    return ok({ url })
  })
}
