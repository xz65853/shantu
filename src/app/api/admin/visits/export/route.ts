import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guard } from '@/lib/api'
import { pageLabel } from '@/lib/mini-path'
import { regionLabel } from '@/lib/ip-region'

export const dynamic = 'force-dynamic'

/**
 * 访问分析明细导出（CSV，Excel 可直接打开）
 *
 * 与 /admin/visits?tab=history 完全同参数、同口径：
 *   src   = mini | web | all（默认 mini）
 *   ch    = ad | organic | all（默认 all）
 *   range = 1 | 7 | 30（默认 30，即最近一个月）
 *
 * 注意：导出含手机号（脱敏口径与页面一致由导出内容决定，此处默认脱敏）。
 */
export async function GET(req: NextRequest) {
  const { error } = await guard('dashboard')
  if (error) return error

  const sp = req.nextUrl.searchParams
  const src = sp.get('src') === 'all' ? 'all' : sp.get('src') === 'web' ? 'web' : 'mini'
  const ch = sp.get('ch') === 'ad' || sp.get('ch') === 'organic' ? sp.get('ch')! : ''
  const rangeDays = [1, 7, 30].includes(Number(sp.get('range'))) ? Number(sp.get('range')) : 30

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (rangeDays - 1))

  const where: Record<string, unknown> = { createdAt: { gte: start } }
  if (src === 'mini') where.path = { startsWith: 'MINI:' }
  if (src === 'web') where.NOT = { path: { startsWith: 'MINI:' } }
  if (ch) where.channel = ch

  const rows = await prisma.visitLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20000,
    include: { member: { select: { nickname: true, name: true, phone: true } } },
  })

  const mask = (p?: string | null) =>
    p ? p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''

  const head = ['时间', '用户', '来源端', '渠道', '来源', '落地页', '访问路径', '停留秒数', '是否留资', '是否新用户', 'IP归属地', 'IP']
  const lines = [head.join(',')]
  const p = (n: number) => String(n).padStart(2, '0')
  for (const v of rows) {
    const m = v.member
    const who = m
      ? m.nickname || m.name || mask(m.phone) || '会员'
      : v.openid
      ? `微信访客··${v.openid.slice(-4)}`
      : '匿名访客'
    const isMini = (v.path || '').startsWith('MINI:')
    let pathSeq = ''
    try {
      const arr = JSON.parse(v.pathSeq || '[]')
      if (Array.isArray(arr)) pathSeq = arr.map((x) => pageLabel(String(x))).join(' → ')
    } catch {
      pathSeq = ''
    }
    const cells = [
      `${v.createdAt.getFullYear()}-${p(v.createdAt.getMonth() + 1)}-${p(v.createdAt.getDate())} ${p(v.createdAt.getHours())}:${p(v.createdAt.getMinutes())}:${p(v.createdAt.getSeconds())}`,
      who,
      isMini ? '小程序' : '官网',
      v.channel === 'ad' ? '广告' : v.channel === 'organic' ? '自然' : '未标记',
      v.source || '',
      pageLabel(v.entryPage || v.path),
      pathSeq,
      v.duration == null ? '' : String(v.duration),
      v.isLead ? '是' : '否',
      v.isNew ? '是' : '否',
      regionLabel(v.ip, v.geoClient),
      v.ip || '',
    ]
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
  }

  const csv = '\uFEFF' + lines.join('\r\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="visits_${rangeDays}d_${src}_${ch || 'all'}.csv"`,
    },
  })
}
