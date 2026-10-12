import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok } from '@/lib/api'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'

const UPLOAD_ROOT = path.join('/www/wwwroot/shantu-web', 'uploads')

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED = [...IMAGE_TYPES, ...VIDEO_TYPES]
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

function safeExt(filename: string, mime: string) {
  const ext = path.extname(filename).toLowerCase()
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mp4', '.webm', '.mov']
  if (allowed.includes(ext)) return ext
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'image/svg+xml') return '.svg'
  if (VIDEO_TYPES.includes(mime)) return '.mp4'
  return '.jpg'
}

// 上传图片水印：按「水印设置」动态生成平铺 SVG（默认白字黑边，保证深浅背景都可读）
function num(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function escapeXml(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function watermarkSvg(cfg: { text: string; color: string; opacity: number; fontSize: number; rotate: number; gapX: number; gapY: number }): Buffer {
  const cx = Math.round(cfg.gapX / 2)
  const cy = Math.round(cfg.gapY / 2)
  const svg = `<svg width="${cfg.gapX}" height="${cfg.gapY}" xmlns="http://www.w3.org/2000/svg">
  <text x="${cx}" y="${cy}" font-size="${cfg.fontSize}" font-family="Noto Sans CJK SC, sans-serif" fill="${cfg.color}" fill-opacity="${cfg.opacity}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${cfg.rotate} ${cx} ${cy})">${escapeXml(cfg.text)}</text>
</svg>`
  return Buffer.from(svg)
}

export async function GET(req: NextRequest) {
  const { error } = await guard('media')
  if (error) return error

  return handle(async () => {
    const { searchParams } = new URL(req.url)
    const folder = searchParams.get('folder')
    const q = searchParams.get('q')?.trim()

    const items = await prisma.media.findMany({
      where: {
        ...(folder && folder !== 'all' ? { folder } : {}),
        ...(q ? { filename: { contains: q } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return ok(items)
  })
}

export async function POST(req: NextRequest) {
  const { error } = await guard('media')
  if (error) return error

  return handle(async () => {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const folder = String(form.get('folder') || 'common')

    if (!file) return fail('请选择文件')
    if (!ALLOWED.includes(file.type)) return fail('不支持的文件类型')
    if (file.size > MAX_SIZE) return fail('文件超过 20MB 限制')

    const now = new Date()
    const dirName = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const targetDir = path.join(UPLOAD_ROOT, dirName)
    await mkdir(targetDir, { recursive: true })

    const ext = safeExt(file.name, file.type)
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
    const filePath = path.join(targetDir, filename)

    const raw = Buffer.from(await file.arrayBuffer())
    let outBuffer = raw
    if (file.type.startsWith('image/') && !file.type.includes('svg') && !file.type.includes('gif')) {
      try {
        let pipeline = sharp(raw).resize({ width: 1600, withoutEnlargement: true })
        // 案例「项目图片」、日报/月报截图：按「水印设置」自动平铺水印
        if (folder === 'cases' || folder === 'projects') {
          const s = await getSettings()
          const wmText = (s.upload_wm_text || '').trim()
          if (s.upload_wm_enable !== '0' && wmText) {
            pipeline = pipeline.composite([
              {
                input: watermarkSvg({
                  text: wmText,
                  color: s.upload_wm_color || '#ffffff',
                  opacity: Math.min(1, Math.max(0, num(s.upload_wm_opacity, 0.38))),
                  fontSize: num(s.upload_wm_font_size, 30),
                  rotate: num(s.upload_wm_rotate, -24),
                  gapX: Math.max(80, num(s.upload_wm_gap_x, 420)),
                  gapY: Math.max(80, num(s.upload_wm_gap_y, 240)),
                }),
                tile: true,
              },
            ])
          }
        }
        outBuffer = await pipeline.webp({ quality: 75 }).toBuffer()
      } catch {}
    }
    await writeFile(filePath, outBuffer)

    const relPath = `${dirName}/${filename}`
    const item = await prisma.media.create({
      data: {
        filename: file.name,
        path: relPath,
        url: `/api/files/${relPath}`,
        mimeType: file.type,
        size: file.size,
        folder,
      },
    })

    return ok(item, '上传成功')
  })
}

export async function DELETE(req: NextRequest) {
  const { error } = await guard('media')
  if (error) return error

  return handle(async () => {
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!Number.isFinite(id)) return fail('参数错误')

    const item = await prisma.media.findUnique({ where: { id } })
    if (!item) return fail('文件不存在')

    await prisma.media.delete({ where: { id } })
    try {
      await unlink(path.join(UPLOAD_ROOT, item.path))
    } catch {
      // 文件可能已被清理，忽略
    }
    return ok(null, '已删除')
  })
}
