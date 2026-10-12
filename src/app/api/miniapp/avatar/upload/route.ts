import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { prisma } from '@/lib/db'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const TYPES = ['image/jpeg', 'image/png']

/** 小程序头像上传：jpg/png ≤2MB，存 uploads/avatars，返回完整 https URL */
export async function POST(req: Request) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file || typeof file === 'string') return fail('请选择图片')
    if (!TYPES.includes(file.type)) return fail('仅支持 jpg/png 图片')
    if (file.size > MAX_SIZE) return fail('图片不能超过 2MB')

    const buf = Buffer.from(await file.arrayBuffer())
    // 魔数校验：jpeg FF D8 FF / png 89 50 4E 47
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    if (!isJpg && !isPng) return fail('图片内容无效')

    const ext = isPng ? '.png' : '.jpg'
    const dir = path.join('/www/wwwroot/shantu-web', 'uploads', 'avatars')
    await mkdir(dir, { recursive: true })
    // 覆盖式命名：用 openid 作为文件名，同一用户重复上传会覆盖，避免头像文件无限累积
    const member = await prisma.member.findUnique({ where: { id: payload.id }, select: { openId: true } })
    const openId = member?.openId || String(payload.id)
    const name = `${openId}${ext}`
    await writeFile(path.join(dir, name), buf)

    // 头像直链：走 nginx 静态 /uploads/ 路径（openid 文件名，需公开可读供小程序 <image> 加载）
    const settings = await getSettings()
    const base = (settings.wxapp_api_base || '').replace(/\/+$/, '')
    const url = `${base}/uploads/avatars/${name}`

    // 上传成功即回写会员头像（用自己服务器域名，替换可能过期的微信临时链接）
    try {
      await prisma.member.update({ where: { id: payload.id }, data: { avatar: url } })
    } catch (e) {
      console.error('[avatar] update member avatar failed', e instanceof Error ? e.stack : String(e))
    }
    return ok({ url, avatar: url })
  })
}
