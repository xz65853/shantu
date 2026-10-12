import { NextResponse } from 'next/server'
import { ZodError, type ZodSchema } from 'zod'
import { getCurrentAdmin, canAccess, type PermissionKey } from './auth'

export type ApiResult<T = unknown> = {
  code: number
  message: string
  data?: T
}

/** 面向用户的友好错误：handle() 原样返回 message，不吞成「服务器内部错误」（用于 AI 超时/未配置等） */
export class FriendlyError extends Error {}

export function ok<T>(data?: T, message = 'success'): NextResponse<ApiResult<T>> {
  return NextResponse.json({ code: 0, message, data })
}

export function fail(message: string, code = 1, status = 400): NextResponse<ApiResult> {
  return NextResponse.json({ code, message }, { status })
}

/** 统一异常处理：不把数据库错误暴露给前端 */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn()
    // 若内部直接返回了 ok()/fail() 构造的响应，原样透传
    if (data instanceof Response) return data as unknown as NextResponse<ApiResult>
    return ok(data)
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0]
      return fail(first?.message || '参数校验失败', 422)
    }
    if (error instanceof FriendlyError) {
      return fail(error.message || '网络繁忙，请稍后再试', 500, 500)
    }
    console.error('[API ERROR]', error instanceof Error ? error.stack : String(error))
    const message = error instanceof Error && process.env.NODE_ENV !== 'production' ? error.message : '服务器内部错误'
    return fail(message, 500, 500)
  }
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const json = await req.json().catch(() => ({}))
  return schema.parse(json)
}

/** 后台接口鉴权 */
export async function guard(permission?: PermissionKey) {
  const admin = await getCurrentAdmin()
  if (!admin) return { admin: null, error: fail('未登录或登录已过期', 401, 401) as NextResponse<ApiResult> }
  if (permission && !canAccess(admin.role, permission)) {
    return { admin: null, error: fail('没有操作权限', 403, 403) as NextResponse<ApiResult> }
  }
  return { admin, error: null }
}
