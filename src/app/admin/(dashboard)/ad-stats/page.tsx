import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

const BRAND = '#2563EB'

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * 广告监测看板：腾讯广告点击 → 留资 → 订单 全链路转化。
 *
 * 数据来自 ad_clicks（点击时写入）+ leads/orders 上的 clickid 归因字段。
 * 转化回传状态（report_status）也在明细里展示，方便排查回传是否成功。
 */
export default async function AdStatsPage() {
  await requirePermission('dashboard')

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const tomorrow = new Date(todayStart)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const from30 = new Date(todayStart)
  from30.setDate(from30.getDate() - 29)

  // 补齐 30 天（无数据的日期也要画出来，否则趋势线会跳日期）
  const dayKeys: string[] = []
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(from30)
    d.setDate(d.getDate() + i)
    dayKeys.push(ymd(d))
  }

  const [todayClicks, todayLeads, todayOrders, totalClicks, totalLeads, recent, trendRows] =
    await Promise.all([
      prisma.adClick.count({ where: { createdAt: { gte: todayStart, lt: tomorrow } } }),
      prisma.lead.count({ where: { clickid: { not: null }, createdAt: { gte: todayStart, lt: tomorrow } } }),
      prisma.order.count({ where: { clickid: { not: null }, createdAt: { gte: todayStart, lt: tomorrow } } }),
      prisma.adClick.count(),
      prisma.lead.count({ where: { clickid: { not: null } } }),
      prisma.adClick.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.adClick.findMany({
        where: { createdAt: { gte: from30, lt: tomorrow } },
        select: { createdAt: true },
      }),
    ])

  // 留资/订单按天聚合（以 lead/order 的 clickid 为准）
  const [leadRows, orderRows] = await Promise.all([
    prisma.lead.findMany({
      where: { clickid: { not: null }, createdAt: { gte: from30, lt: tomorrow } },
      select: { createdAt: true },
    }),
    prisma.order.findMany({
      where: { clickid: { not: null }, createdAt: { gte: from30, lt: tomorrow } },
      select: { createdAt: true },
    }),
  ])

  const clickByDay: Record<string, number> = {}
  trendRows.forEach((c) => {
    const k = ymd(c.createdAt)
    clickByDay[k] = (clickByDay[k] || 0) + 1
  })
  const leadByDay: Record<string, number> = {}
  leadRows.forEach((l) => {
    const k = ymd(l.createdAt)
    leadByDay[k] = (leadByDay[k] || 0) + 1
  })
  const orderByDay: Record<string, number> = {}
  orderRows.forEach((o) => {
    const k = ymd(o.createdAt)
    orderByDay[k] = (orderByDay[k] || 0) + 1
  })

  const trend = dayKeys.map((date) => ({
    date,
    clicks: clickByDay[date] || 0,
    leads: leadByDay[date] || 0,
    orders: orderByDay[date] || 0,
  }))

  const maxVal = Math.max(1, ...trend.map((t) => Math.max(t.clicks, t.leads, t.orders)))
  const leadRate = todayClicks > 0 ? ((todayLeads / todayClicks) * 100).toFixed(1) : '0.0'
  const totalRate = totalClicks > 0 ? ((totalLeads / totalClicks) * 100).toFixed(1) : '0.0'

  // 简易 SVG 折线图（项目未装图表库，避免为一张图引入依赖）
  const W = 900
  const H = 220
  const PAD = { l: 36, r: 12, t: 12, b: 26 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const xAt = (i: number) => PAD.l + (innerW * i) / Math.max(1, trend.length - 1)
  const yAt = (v: number) => PAD.t + innerH - (innerH * v) / maxVal

  const line = (key: 'clicks' | 'leads' | 'orders') =>
    trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(t[key]).toFixed(1)}`).join(' ')

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r))

  const REPORT_LABEL: Record<string, string> = {
    SUCCESS: '已回传',
    FAILED: '回传失败',
    SKIPPED: '未回传(无令牌)',
    PENDING: '待回传',
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="广告监测"
        desc="腾讯广告点击 → 留资 → 订单 全链路转化数据"
      />

      {/* 今日 4 个数字卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox label="今日点击" value={todayClicks} color="#1E2A3B" />
        <StatBox label="今日留资" value={todayLeads} color="#22A06B" />
        <StatBox label="今日订单" value={todayOrders} color={BRAND} />
        <StatBox label="今日留资率" value={`${leadRate}%`} color="#E5484D" />
      </div>

      {/* 累计 */}
      <div
        className="rounded-xl border p-4"
        style={{ background: '#fff', borderColor: '#E8ECF2' }}
      >
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span style={{ color: '#9AA7B8' }}>
            累计点击 <b style={{ color: '#1E2A3B' }}>{totalClicks}</b>
          </span>
          <span style={{ color: '#9AA7B8' }}>
            累计留资 <b style={{ color: '#22A06B' }}>{totalLeads}</b>
          </span>
          <span style={{ color: '#9AA7B8' }}>
            整体留资率 <b style={{ color: '#E5484D' }}>{totalRate}%</b>
          </span>
          <span style={{ color: '#9AA7B8' }} className="ml-auto">
            监测链接：
            <code style={{ color: '#1E2A3B' }}>
              /api/ad/tencent/click?cid={'{CLICKID}'}
            </code>
          </span>
        </div>
      </div>

      {/* 近30天趋势 */}
      <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: '#1E2A3B' }}>
            近 30 天趋势
          </h3>
          <div className="flex items-center gap-4 text-xs" style={{ color: '#9AA7B8' }}>
            <Legend color="#1E2A3B" label="点击" />
            <Legend color="#22A06B" label="留资" />
            <Legend color={BRAND} label="订单" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="min-w-[720px]">
            {gridVals.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={yAt(v)}
                  y2={yAt(v)}
                  stroke="#EEF1F5"
                  strokeWidth={1}
                />
                <text x={PAD.l - 6} y={yAt(v) + 3} fontSize={10} textAnchor="end" fill="#9AA7B8">
                  {v}
                </text>
              </g>
            ))}

            <path d={line('clicks')} fill="none" stroke="#1E2A3B" strokeWidth={2} />
            <path d={line('leads')} fill="none" stroke="#22A06B" strokeWidth={2} />
            <path d={line('orders')} fill="none" stroke={BRAND} strokeWidth={2} />

            {trend.map((t, i) =>
              i % 5 === 0 ? (
                <text key={t.date} x={xAt(i)} y={H - 8} fontSize={10} textAnchor="middle" fill="#9AA7B8">
                  {t.date.slice(5)}
                </text>
              ) : null,
            )}
          </svg>
        </div>
      </div>

      {/* 点击明细 */}
      <div className="rounded-xl border" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
        <div className="border-b p-4 text-sm font-semibold" style={{ color: '#1E2A3B', borderColor: '#EEF1F5' }}>
          最近点击记录（最多 50 条）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr style={{ background: '#F7F8FA' }}>
                <Th>时间</Th>
                <Th>ClickID</Th>
                <Th>IP</Th>
                <Th>留资</Th>
                <Th>下单</Th>
                <Th>回传状态</Th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center" style={{ color: '#9AA7B8' }}>
                    暂无点击记录。把监测链接填进腾讯广告后台后，这里就会有数据。
                  </td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #EEF1F5' }}>
                  <Td>{r.createdAt.toLocaleString('zh-CN', { hour12: false })}</Td>
                  <Td>
                    <code style={{ fontSize: 12, color: '#1E2A3B' }}>{r.clickid}</code>
                  </Td>
                  <Td style={{ color: '#9AA7B8' }}>{r.ip || '—'}</Td>
                  <Td>{r.isConverted ? <Tag color="#22A06B" text="已留资" /> : <span style={{ color: '#C4CBD4' }}>否</span>}</Td>
                  <Td>{r.isOrdered ? <Tag color={BRAND} text="已下单" /> : <span style={{ color: '#C4CBD4' }}>否</span>}</Td>
                  <Td>
                    {r.reportStatus ? (
                      <Tag
                        color={r.reportStatus === 'SUCCESS' ? '#22A06B' : r.reportStatus === 'FAILED' ? '#E5484D' : '#9AA7B8'}
                        text={REPORT_LABEL[r.reportStatus] || r.reportStatus}
                        title={r.reportError || ''}
                      />
                    ) : (
                      <span style={{ color: '#C4CBD4' }}>—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
      <div className="text-xs" style={{ color: '#9AA7B8' }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span style={{ width: 14, height: 3, background: color, borderRadius: 2, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: '#6B7A8D' }}>
      {children}
    </th>
  )
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td className="px-4 py-2.5 text-xs" style={{ color: '#1E2A3B', ...style }}>
      {children}
    </td>
  )
}

function Tag({ color, text, title }: { color: string; text: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        color,
        background: `${color}1A`,
      }}
    >
      {text}
    </span>
  )
}
