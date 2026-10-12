import { prisma } from './db'

export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    ''
  )
}

/** 手机号脱敏（日志中不落明文） */
function maskPhone(p: string) {
  return p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

/** 递归脱敏：phone 打码，password/secret 类字段剔除 */
function sanitize(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === 'phone') out[k] = typeof v === 'string' ? maskPhone(v) : v
      else if (/(password|secret|_hash|token)$/i.test(k)) continue
      else out[k] = sanitize(v)
    }
    return out
  }
  return obj
}

/** 登录日志：成功/失败都记（失败不抛错，不影响主流程） */
export async function logLogin(params: {
  adminId?: number | null
  username: string
  ip: string
  ua?: string | null
  status: 'success' | 'fail'
  failReason?: string | null
}) {
  try {
    await prisma.adminLoginLog.create({
      data: {
        adminId: params.adminId ?? null,
        username: params.username,
        ip: params.ip || null,
        ua: params.ua || null,
        status: params.status,
        failReason: params.failReason || null,
      },
    })
  } catch (e) {
    console.warn('[admin-log] login log failed', e instanceof Error ? e.message : '')
  }
}

/** 操作日志：记录关键写操作前后快照（before/after 自动脱敏） */
export async function logOperation(params: {
  adminId?: number | null
  username?: string | null
  module: string
  action: string
  targetType?: string | null
  targetId?: number | null
  before?: unknown
  after?: unknown
  ip?: string | null
  ua?: string | null
}) {
  try {
    await prisma.adminOperationLog.create({
      data: {
        adminId: params.adminId ?? null,
        username: params.username || null,
        module: params.module,
        action: params.action,
        targetType: params.targetType || null,
        targetId: params.targetId ?? null,
        beforeJson: params.before !== undefined ? JSON.stringify(sanitize(params.before)) : null,
        afterJson: params.after !== undefined ? JSON.stringify(sanitize(params.after)) : null,
        ip: params.ip || null,
        ua: params.ua || null,
      },
    })
  } catch (e) {
    console.warn('[admin-log] operation log failed', e instanceof Error ? e.message : '')
  }
}
