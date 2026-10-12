import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { getMemberFromRequest } from '@/lib/member-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPLOAD_ROOT = path.join('/www/wwwroot/shantu-web', 'uploads')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
}

/** 素材库目录按「年月」命名（如 202609），用于官网案例/文章配图，属于对外公开内容 */
function isPublicAssetDir(seg: string) {
  return /^\d{6}$/.test(seg)
}

type AuthResult = { ok: true; cacheable: boolean } | { ok: false; status: number }

/**
 * 上传文件分级访问控制
 *
 * 【背景】本路由原先不做任何鉴权，导致 uploads/contracts 下的合同 PDF
 * （含客户真实姓名、手机号、身份证号、合同金额、手写签名图）可被匿名下载。
 *
 * 【策略】fail-closed —— 未显式放行的目录一律拒绝。
 *
 * | 目录            | 内容                     | 策略                                   |
 * |-----------------|--------------------------|----------------------------------------|
 * | contracts/      | 合同 PDF + 手写签名图     | 禁止经本路由访问（必须走鉴权路由）      |
 * | project-daily/  | 日报图片（客户经营数据）  | 需登录（管理员或会员）                  |
 * | avatars/        | 会员头像                  | 需登录（管理员或会员）                  |
 * | YYYYMM/         | 素材库图片/视频           | 公开（官网案例与文章依赖其匿名可访问）  |
 * | 其他            | —                        | 拒绝                                   |
 *
 * 合同 PDF 的合法访问路径（均已做归属/权限校验）：
 * - GET /api/miniapp/contracts/[id]/pdf  会员本人
 * - GET /api/admin/contracts/[id]/pdf    后台管理员
 */
async function authorize(seg0: string, req: NextRequest): Promise<AuthResult> {
  // 合同 PDF 与签名图：含高度敏感个人信息，禁止经通用文件路由访问
  if (seg0 === 'contracts' || seg0 === 'signatures') {
    return { ok: false, status: 403 }
  }

  // 素材库：官网对外展示内容，保持匿名可读（改为需登录会导致官网图片/视频 403）
  if (isPublicAssetDir(seg0)) {
    return { ok: true, cacheable: true }
  }

  // 日报图片 / 头像：至少要求登录态
  if (seg0 === 'project-daily' || seg0 === 'avatars') {
    const admin = await getCurrentAdmin()
    if (admin) return { ok: true, cacheable: false }
    const member = await getMemberFromRequest(req)
    if (member) return { ok: true, cacheable: false }
    return { ok: false, status: 401 }
  }

  // fail-closed：未知目录一律拒绝
  return { ok: false, status: 403 }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segs } = await params
  if (!segs || segs.length === 0) return new Response('Not Found', { status: 404 })

  const rel = segs.join('/')
  // 防目录穿越：规范化后必须仍在 UPLOAD_ROOT 之内（含分隔符判断，避免 /uploads-xxx 前缀绕过）
  const target = path.normalize(path.join(UPLOAD_ROOT, rel))
  if (target !== UPLOAD_ROOT && !target.startsWith(UPLOAD_ROOT + path.sep)) {
    return new Response('Forbidden', { status: 403 })
  }

  const auth = await authorize(segs[0], req)
  if (!auth.ok) {
    return new Response(auth.status === 401 ? 'Unauthorized' : 'Forbidden', { status: auth.status })
  }

  try {
    const info = await stat(target)
    if (!info.isFile()) return new Response('Not Found', { status: 404 })
    const data = await readFile(target)
    const ext = path.extname(target).toLowerCase()
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // 需鉴权的内容禁止被 CDN / 中间代理缓存
        'Cache-Control': auth.cacheable
          ? 'public, max-age=31536000, immutable'
          : 'private, no-store, max-age=0',
      },
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
}
