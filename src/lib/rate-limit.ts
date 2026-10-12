/**
 * 简易内存限流（单实例 PM2 fork 模式足够）。
 * 用法：if (rateLimited(`orders:${ip}`, 5, 60_000)) return fail('过于频繁', 429, 429)
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const item = buckets.get(key)
  if (!item || item.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // 防内存膨胀：惰性清理
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k)
    }
    return false
  }
  item.count += 1
  return item.count > limit
}

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
