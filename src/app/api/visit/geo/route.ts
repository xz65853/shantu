import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 客户端 JSONP 归属地回填（官网 H5 专用）
 *
 * 官网页面加载 ping0.cc 的 JSONP 拿到访客自己的 IP / 归属地 / ASN / 运营商，
 * 再由本接口回填到访问记录上。
 *
 * 匹配策略（按优先级）：
 *  1. IP 精确匹配：最近 10 分钟内、同 IP、未回填的记录
 *  2. UA + 时间窗兜底：JSONP 拿到的是访客 IPv6，而服务器记录的可能是 IPv4
 *     （或反过来），此时用浏览器 UA 前缀 + 时间窗匹配同一台设备
 *
 * 设计要点：
 *  - 不登录也能上报（访问分析要统计匿名访客）
 *  - 一次回填该窗口内同一访客产生的多条记录（用户连翻多个页面）
 *  - 超时/失败一律静默，前端不感知，离线 ip2region 照常兜底
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      ip?: string
      location?: string
    }

    const ip = String(body.ip || '').trim().slice(0, 60)
    const location = String(body.location || '').trim().slice(0, 120)

    if (!ip || !location) {
      return NextResponse.json({ ok: false, reason: 'missing' }, { status: 200 })
    }

    const since = new Date(Date.now() - 10 * 60 * 1000)
    const ua = (req.headers.get('user-agent') || '').slice(0, 80)

    // 先按 IP 匹配；IP 对不上（IPv4/IPv6 差异）时，用 UA 前缀 + 时间窗兜底
    const or: Record<string, unknown>[] = [{ ip }]
    if (ua) or.push({ ua: { startsWith: ua } })

    const result = await prisma.visitLog.updateMany({
      where: {
        createdAt: { gte: since },
        geoClient: null,
        OR: or,
      },
      data: {
        geoClient: location,
        ip: ip,
      },
    })

    return NextResponse.json({ ok: true, updated: result.count })
  } catch (e) {
    // 任何异常都不能影响页面，静默返回
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 200 })
  }
}
