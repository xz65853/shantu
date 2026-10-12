import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { pageLabel } from '@/lib/mini-path'
import { regionLabel } from '@/lib/ip-region'

export const dynamic = 'force-dynamic'

const BRAND = '#2563EB'
const INK = '#1E2A3B'
const MUTED = '#9AA7B8'
const SUB = '#5B6B82'
const LINE = '#E8ECF2'

/**
 * 手机号是否脱敏。
 * 完整展示需同时满足三个前置条件，缺一不可：
 *   1. 小程序《隐私政策》明示收集手机号用途并取得同意（现有概括式勾选不合规）
 *   2. 本页限管理员角色访问，其他角色强制脱敏
 *   3. 查看与导出写入审计日志并保留不少于 6 个月
 * 三项全部改造完成后才可将此处改为 false。
 */
const MASK_PHONE = true

const PAGE_SIZE = 20

function maskPhone(p?: string | null): string {
  if (!p) return ''
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 月-日 时:分:秒，用于跨多日的历史明细 */
function fmtDT(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function fmtDur(s?: number | null): string {
  if (s == null) return '—'
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec ? `${m}分${sec}秒` : `${m}分`
}

function fmtPath(seq?: string | null): string {
  if (!seq) return '—'
  try {
    const arr = JSON.parse(seq)
    return Array.isArray(arr) && arr.length ? arr.map((p) => pageLabel(String(p))).join(' → ') : '—'
  } catch {
    return '—'
  }
}

function pct(n: number, total: number): string {
  if (!total) return '0.0'
  return ((n / total) * 100).toFixed(1)
}

function StatBox({ label, value, color, hint }: { label: string; value: string | number; color: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: LINE }}>
      <div className="text-xs" style={{ color: MUTED }}>{label}</div>
      <div className="mt-1.5 text-2xl font-bold" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-xs" style={{ color: MUTED }}>{hint}</div> : null}
    </div>
  )
}

/** IP + 归属地：优先展示客户端上报的真实归属地，拿不到再退回离线库 */
function IpCell({ ip, geo }: { ip?: string | null; geo?: string | null }) {
  const region = regionLabel(ip, geo)
  if (!region && !ip) return <span style={{ color: MUTED }}>—</span>
  return (
    <span className="whitespace-nowrap">
      {region ? <span style={{ color: SUB }}>{region} </span> : null}
      <span className="font-mono" style={{ color: MUTED }}>{ip || ''}</span>
    </span>
  )
}

function ChannelTag({ channel }: { channel?: string | null }) {
  if (channel === 'ad') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: BRAND }}>
        广告
      </span>
    )
  }
  if (channel === 'organic') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: '#38BDF8' }}>
        自然
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs" style={{ background: '#F1F5F9', color: MUTED }}>
      未标记
    </span>
  )
}

/**
 * 来源端筛选。
 * 官网（Web）与小程序（Mini）的会话都在 visit_logs 里，靠 path 前缀区分：
 * 小程序会话上报时统一写成 `MINI:pages/xxx/xxx`，官网则是 `/`、`/blog` 这类路径。
 * 广告监测的对象是小程序，所以默认只看小程序，避免官网自然流量稀释渠道占比。
 */
type SrcKey = 'mini' | 'web' | 'all'

function buildWhere(from: Date, src: SrcKey) {
  const time = { createdAt: { gte: from } }
  if (src === 'mini') return { ...time, path: { startsWith: 'MINI:' } }
  if (src === 'web') return { ...time, NOT: { path: { startsWith: 'MINI:' } } }
  return time
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; src?: string; range?: string; ch?: string }>
}) {
  await requirePermission('dashboard')

  const sp = await searchParams
  const tab = sp.tab === 'flow' || sp.tab === 'history' ? sp.tab : 'overview'
  const page = Math.max(1, Number(sp.page) || 1)
  const src: SrcKey = sp.src === 'all' ? 'all' : sp.src === 'web' ? 'web' : 'mini'
  // 历史明细的时间范围：1 / 7 / 30 天，默认 30 天（最近一个月）
  const rangeDays = [1, 7, 30].includes(Number(sp.range)) ? Number(sp.range) : 30
  const rangeLabel = rangeDays === 1 ? '今日' : `近 ${rangeDays} 天`
  // 历史明细的渠道筛选
  const ch: 'ad' | 'organic' | '' = sp.ch === 'ad' || sp.ch === 'organic' ? sp.ch : ''

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const from7 = new Date(startOfToday)
  from7.setDate(from7.getDate() - 6)
  const fromRange = new Date(startOfToday)
  fromRange.setDate(fromRange.getDate() - (rangeDays - 1))

  // 历史明细的查询条件：时间范围 + 来源端 + 渠道
  function buildHistoryWhere() {
    const w: Record<string, unknown> = { createdAt: { gte: fromRange } }
    if (src === 'mini') w.path = { startsWith: 'MINI:' }
    if (src === 'web') w.NOT = { path: { startsWith: 'MINI:' } }
    if (ch) w.channel = ch
    return w
  }

  // ---- 今日会话数据（渠道 / 来源 / 新用户 / 留资）----
  const todayRows = await prisma.visitLog.findMany({
    where: buildWhere(startOfToday, src),
    select: { channel: true, source: true, isNew: true, isLead: true },
  })

  // ---- 近 7 日趋势 ----
  const weekRows = await prisma.visitLog.findMany({
    where: buildWhere(from7, src),
    select: { createdAt: true, channel: true },
  })

  const uv = todayRows.length
  const adUv = todayRows.filter((r) => r.channel === 'ad').length
  const organicUv = todayRows.filter((r) => r.channel === 'organic').length
  const unmarkedUv = uv - adUv - organicUv
  const newUser = todayRows.filter((r) => r.isNew).length
  const newUserAd = todayRows.filter((r) => r.isNew && r.channel === 'ad').length
  const leads = todayRows.filter((r) => r.isLead).length
  const leadsAd = todayRows.filter((r) => r.isLead && r.channel === 'ad').length
  const adRate = uv ? pct(adUv, uv) : '0.0'

  // ---- 来源明细 ----
  const sourceMap = new Map<string, { uv: number; newUser: number; leads: number }>()
  todayRows.forEach((r) => {
    const key = r.source || (r.channel === 'ad' ? '腾讯广告' : '历史数据（未标记渠道）')
    const cur = sourceMap.get(key) || { uv: 0, newUser: 0, leads: 0 }
    cur.uv += 1
    if (r.isNew) cur.newUser += 1
    if (r.isLead) cur.leads += 1
    sourceMap.set(key, cur)
  })
  const sourceRows = [...sourceMap.entries()]
    .map(([source, v]) => ({ source, ...v, rate: pct(v.leads, v.uv) }))
    .sort((a, b) => b.uv - a.uv)

  // ---- 7 日趋势聚合 ----
  const dayKeys: string[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(startOfToday)
    d.setDate(d.getDate() - i)
    const p = (n: number) => String(n).padStart(2, '0')
    dayKeys.push(`${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  }
  const dayMap = new Map<string, { ad: number; organic: number; unknown: number }>()
  dayKeys.forEach((k) => dayMap.set(k, { ad: 0, organic: 0, unknown: 0 }))
  weekRows.forEach((r) => {
    const p = (n: number) => String(n).padStart(2, '0')
    const k = `${p(r.createdAt.getMonth() + 1)}-${p(r.createdAt.getDate())}`
    const cur = dayMap.get(k)
    if (!cur) return
    if (r.channel === 'ad') cur.ad += 1
    else if (r.channel === 'organic') cur.organic += 1
    else cur.unknown += 1
  })
  const trend = dayKeys.map((k) => ({ date: k, ...(dayMap.get(k) || { ad: 0, organic: 0, unknown: 0 }) }))
  const trendMax = Math.max(1, ...trend.map((t) => t.ad + t.organic + t.unknown))

  // ---- 今日访问流水 ----
  let flowRows: Awaited<
    ReturnType<typeof prisma.visitLog.findMany>
  > = []
  let flowTotal = 0
  if (tab === 'flow') {
    const where = buildWhere(startOfToday, src)
    const [rows, total] = await Promise.all([
      prisma.visitLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { member: { select: { nickname: true, name: true, phone: true } } },
      }),
      prisma.visitLog.count({ where }),
    ])
    flowRows = rows
    flowTotal = total
  }

  const totalPages = Math.max(1, Math.ceil(flowTotal / PAGE_SIZE))

  // ---- 历史明细（可追溯最近一个月）----
  let historyAgg: { uv: number; adUv: number; organicUv: number; newUser: number; leads: number } | null = null
  let historySourceRows: { source: string; uv: number; newUser: number; leads: number; rate: string }[] = []
  let historyRows: Awaited<
    ReturnType<typeof prisma.visitLog.findMany>
  > = []
  let historyTotal = 0
  if (tab === 'history') {
    const where = buildHistoryWhere()
    const [aggRows, rows, total] = await Promise.all([
      prisma.visitLog.findMany({
        where,
        select: { channel: true, source: true, isNew: true, isLead: true },
      }),
      prisma.visitLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { member: { select: { nickname: true, name: true, phone: true } } },
      }),
      prisma.visitLog.count({ where }),
    ])
    const adUv = aggRows.filter((r) => r.channel === 'ad').length
    const organicUv = aggRows.filter((r) => r.channel === 'organic').length
    historyAgg = {
      uv: aggRows.length,
      adUv,
      organicUv,
      newUser: aggRows.filter((r) => r.isNew).length,
      leads: aggRows.filter((r) => r.isLead).length,
    }
    const sm = new Map<string, { uv: number; newUser: number; leads: number }>()
    aggRows.forEach((r) => {
      const key = r.source || (r.channel === 'ad' ? '腾讯广告' : '历史数据（未标记渠道）')
      const cur = sm.get(key) || { uv: 0, newUser: 0, leads: 0 }
      cur.uv += 1
      if (r.isNew) cur.newUser += 1
      if (r.isLead) cur.leads += 1
      sm.set(key, cur)
    })
    historySourceRows = [...sm.entries()]
      .map(([source, v]) => ({ source, ...v, rate: pct(v.leads, v.uv) }))
      .sort((a, b) => b.uv - a.uv)
    historyRows = rows
    historyTotal = total
  }
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE))

  // 历史明细的筛选链接（保留来源端、渠道、时间范围）
  function historyHref(over: Partial<{ range: number; ch: string; src: string; page: number }>) {
    const p = new URLSearchParams()
    p.set('tab', 'history')
    p.set('src', over.src ?? src)
    p.set('range', String(over.range ?? rangeDays))
    if (over.ch !== undefined ? over.ch : ch) p.set('ch', over.ch !== undefined ? over.ch : ch)
    if (over.page) p.set('page', String(over.page))
    return `/admin/visits?${p.toString()}`
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="访问分析"
        desc="渠道标记（自然 / 广告）与用户访问记录。默认只统计小程序会话，可切换查看官网流量"
      />

      {/* 子标签栏 + 来源端筛选 */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-1"
        style={{ borderColor: LINE }}
      >
        <div className="flex items-center gap-6">
          {[
            { key: 'overview', label: '渠道总览' },
            { key: 'flow', label: '今日访问流水' },
            { key: 'history', label: '历史明细（近一月）' },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/admin/visits?tab=${t.key}&src=${src}`}
              className="pb-2 text-sm transition"
              style={{
                color: tab === t.key ? BRAND : MUTED,
                fontWeight: tab === t.key ? 600 : 400,
                borderBottom: `2px solid ${tab === t.key ? BRAND : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 pb-2">
          <span className="mr-1 text-xs" style={{ color: MUTED }}>
            来源端
          </span>
          {[
            { key: 'mini', label: '小程序' },
            { key: 'web', label: '官网' },
            { key: 'all', label: '全部' },
          ].map((s) => (
            <Link
              key={s.key}
              href={`/admin/visits?tab=${tab}&src=${s.key}`}
              className="rounded-full px-2.5 py-1 text-xs transition"
              style={{
                background: src === s.key ? '#EFF4FF' : 'transparent',
                color: src === s.key ? BRAND : MUTED,
                fontWeight: src === s.key ? 600 : 400,
              }}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 历史明细筛选：时间范围 / 渠道 / 导出 */}
      {tab === 'history' ? (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs" style={{ color: MUTED }}>
              时间范围
            </span>
            {[1, 7, 30].map((d) => (
              <Link
                key={d}
                href={historyHref({ range: d, page: 1 })}
                className="rounded-full px-2.5 py-1 text-xs transition"
                style={{
                  background: rangeDays === d ? '#EFF4FF' : 'transparent',
                  color: rangeDays === d ? BRAND : MUTED,
                  fontWeight: rangeDays === d ? 600 : 400,
                }}
              >
                {d === 1 ? '今日' : `近 ${d} 天`}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs" style={{ color: MUTED }}>
              渠道
            </span>
            {[
              { key: '', label: '全部' },
              { key: 'ad', label: '广告' },
              { key: 'organic', label: '自然' },
            ].map((c) => (
              <Link
                key={c.key}
                href={historyHref({ ch: c.key, page: 1 })}
                className="rounded-full px-2.5 py-1 text-xs transition"
                style={{
                  background: ch === c.key ? '#EFF4FF' : 'transparent',
                  color: ch === c.key ? BRAND : MUTED,
                  fontWeight: ch === c.key ? 600 : 400,
                }}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <a
            href={`/api/admin/visits/export?src=${src}&range=${rangeDays}${ch ? `&ch=${ch}` : ''}`}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs text-white"
            style={{ background: BRAND }}
          >
            导出 CSV
          </a>
        </div>
      ) : null}

      {tab === 'overview' ? (
        <>
          {/* 四个数字卡 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatBox label="今日访问会话" value={uv} color={INK} hint={`广告 ${adUv} · 自然 ${organicUv}`} />
            <StatBox label="新用户" value={newUser} color={INK} hint={`其中广告来源 ${newUserAd}`} />
            <StatBox label="广告来源占比" value={`${adRate}%`} color={BRAND} hint={`自然 ${pct(organicUv, uv)}%`} />
            <StatBox label="今日留资" value={leads} color="#22A06B" hint={`广告 ${leadsAd}`} />
          </div>

          {/* 渠道分布 */}
          <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: LINE }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: INK }}>
              渠道分布　今日
            </h3>
            <div className="flex h-10 w-full overflow-hidden rounded-lg">
              {adUv > 0 ? (
                <div
                  className="flex items-center justify-center text-xs font-medium text-white"
                  style={{ background: BRAND, width: `${(adUv / Math.max(1, uv)) * 100}%` }}
                >
                  广告 {adRate}%
                </div>
              ) : null}
              {organicUv > 0 ? (
                <div
                  className="flex items-center justify-center text-xs font-medium text-white"
                  style={{ background: '#38BDF8', width: `${(organicUv / Math.max(1, uv)) * 100}%` }}
                >
                  自然 {pct(organicUv, uv)}%
                </div>
              ) : null}
              {unmarkedUv > 0 ? (
                <div
                  className="flex items-center justify-center text-xs"
                  style={{ background: '#E2E8F0', color: SUB, width: `${(unmarkedUv / Math.max(1, uv)) * 100}%` }}
                >
                  未标记 {pct(unmarkedUv, uv)}%
                </div>
              ) : null}
              {uv === 0 ? (
                <div className="flex w-full items-center justify-center text-xs" style={{ background: '#F1F5F9', color: MUTED }}>
                  今日暂无数据
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-5 text-xs" style={{ color: SUB }}>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: BRAND }} />广告来源 {adUv}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#38BDF8' }} />自然来源 {organicUv}
              </span>
              {unmarkedUv > 0 ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#E2E8F0' }} />未标记 {unmarkedUv}
                </span>
              ) : null}
            </div>
            <div className="mt-3 rounded-lg p-3 text-xs leading-5" style={{ background: '#F8FAFC', color: SUB }}>
              <div>广告：进入时携带 clickid 的腾讯广告来源</div>
              <div>自然：微信搜索、好友分享、扫码、历史留存等无 clickid 来源</div>
              <div>未标记：本功能上线前沉淀的历史记录，无渠道字段</div>
            </div>
          </div>

          {/* 近 7 日趋势 */}
          <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: LINE }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: INK }}>近 7 日渠道趋势</h3>
              <div className="flex items-center gap-4 text-xs" style={{ color: MUTED }}>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: BRAND }} />广告
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#38BDF8' }} />自然
                </span>
              </div>
            </div>
            <div className="flex h-40 items-end gap-4">
              {trend.map((t) => {
                const total = t.ad + t.organic + t.unknown
                return (
                  <div key={t.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div className="text-xs" style={{ color: MUTED }}>{total || ''}</div>
                    <div className="flex w-full flex-col justify-end" style={{ height: 110 }}>
                      {t.unknown > 0 ? (
                        <div style={{ height: `${(t.unknown / trendMax) * 110}px`, background: '#E2E8F0' }} />
                      ) : null}
                      {t.organic > 0 ? (
                        <div style={{ height: `${(t.organic / trendMax) * 110}px`, background: '#38BDF8' }} />
                      ) : null}
                      {t.ad > 0 ? (
                        <div style={{ height: `${(t.ad / trendMax) * 110}px`, background: BRAND }} />
                      ) : null}
                    </div>
                    <div className="text-xs" style={{ color: MUTED }}>{t.date}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 来源明细 */}
          <div className="rounded-xl border" style={{ background: '#fff', borderColor: LINE }}>
            <div className="border-b p-4 text-sm font-semibold" style={{ color: INK, borderColor: '#EEF1F5' }}>
              来源明细　今日
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#FAFBFD', color: MUTED, fontSize: 12 }}>
                    <th className="px-4 py-2 text-left font-medium">来源</th>
                    <th className="px-4 py-2 text-right font-medium">访问会话</th>
                    <th className="px-4 py-2 text-right font-medium">新用户</th>
                    <th className="px-4 py-2 text-right font-medium">留资</th>
                    <th className="px-4 py-2 text-right font-medium">留资率</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.length ? (
                    sourceRows.map((r) => (
                      <tr key={r.source} className="border-t" style={{ borderColor: '#F0F3F8' }}>
                        <td className="px-4 py-3" style={{ color: INK }}>{r.source}</td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: INK }}>{r.uv}</td>
                        <td className="px-4 py-3 text-right" style={{ color: SUB }}>{r.newUser}</td>
                        <td className="px-4 py-3 text-right" style={{ color: SUB }}>{r.leads}</td>
                        <td className="px-4 py-3 text-right" style={{ color: SUB }}>{r.rate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-xs" style={{ color: MUTED }}>
                        今日暂无数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-3 text-xs leading-5" style={{ borderColor: '#EEF1F5', color: MUTED }}>
              口径：来源以会话进入时是否携带 clickid 判定；同一会话多次上报按 visit_id 幂等覆盖，不重复计数；留资以提交预约表单为准。
            </div>
          </div>
        </>
      ) : tab === 'flow' ? (
        <>
          {/* 今日访问流水 */}
          <div className="rounded-xl border" style={{ background: '#fff', borderColor: LINE }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: '#EEF1F5' }}>
              <h3 className="text-sm font-semibold" style={{ color: INK }}>今日访问流水</h3>
              <span className="text-xs" style={{ color: MUTED }}>
                共 {flowTotal} 条　广告 {adUv}　自然 {organicUv}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#FAFBFD', color: MUTED }}>
                    <th className="px-4 py-2 text-left font-medium">时间</th>
                    <th className="px-4 py-2 text-left font-medium">用户</th>
                    <th className="px-4 py-2 text-left font-medium">来源端</th>
                    <th className="px-4 py-2 text-left font-medium">渠道</th>
                    <th className="px-4 py-2 text-left font-medium">来源</th>
                    <th className="px-4 py-2 text-left font-medium">落地页</th>
                    <th className="px-4 py-2 text-left font-medium">访问路径</th>
                    <th className="px-4 py-2 text-right font-medium">停留</th>
                    <th className="px-4 py-2 text-center font-medium">留资</th>
                    <th className="px-4 py-2 text-left font-medium">IP / 归属地</th>
                  </tr>
                </thead>
                <tbody>
                  {flowRows.length ? (
                    flowRows.map((v) => {
                      const m = v.member
                      // 三级身份：会员 → 微信访客（有 openid，未关联到会员）→ 匿名访客
                      const who = m
                        ? m.nickname || m.name || (MASK_PHONE ? maskPhone(m.phone) : m.phone) || '会员'
                        : v.openid
                        ? `微信访客 ··${v.openid.slice(-4)}`
                        : '匿名访客'
                      const isMini = (v.path || '').startsWith('MINI:')
                      return (
                        <tr key={v.id} className="border-t" style={{ borderColor: '#F0F3F8' }}>
                          <td className="whitespace-nowrap px-4 py-3 font-mono" style={{ color: MUTED }}>
                            {fmtTime(v.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: m ? INK : MUTED }}>
                            {who}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                              style={{
                                background: isMini ? '#EEF2FF' : '#F1F5F9',
                                color: isMini ? '#4F46E5' : MUTED,
                              }}
                            >
                              {isMini ? '小程序' : '官网'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ChannelTag channel={v.channel} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: SUB }}>
                            {v.source || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: SUB }}>
                            {pageLabel(v.entryPage || v.path)}
                          </td>
                          <td className="px-4 py-3" style={{ color: MUTED }}>
                            {fmtPath(v.pathSeq)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right" style={{ color: SUB }}>
                            {fmtDur(v.duration)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {v.isLead ? (
                              <span className="font-medium" style={{ color: BRAND }}>已留资</span>
                            ) : (
                              <span style={{ color: MUTED }}>未留资</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <IpCell ip={v.ip} geo={v.geoClient} />
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-xs" style={{ color: MUTED }}>
                        今日暂无{src === 'mini' ? '小程序' : src === 'web' ? '官网' : ''}访问记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {flowTotal > PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: '#EEF1F5' }}>
                <span className="text-xs" style={{ color: MUTED }}>
                  共 {flowTotal} 条　每页 {PAGE_SIZE} 条　第 {page} / {totalPages} 页
                </span>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/admin/visits?tab=flow&src=${src}&page=${page - 1}`}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: '#F4F6FA', color: SUB }}
                    >
                      上一页
                    </Link>
                  ) : null}
                  {page < totalPages ? (
                    <Link
                      href={`/admin/visits?tab=flow&src=${src}&page=${page + 1}`}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: '#F4F6FA', color: INK }}
                    >
                      下一页
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* 合规约束 */}
          <div
            className="rounded-xl border p-4"
            style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: '#9A3412' }}>
              完整手机号展示的三个前置条件
            </h3>
            <div className="mt-2 space-y-1.5 text-xs leading-5" style={{ color: '#7C2D12' }}>
              <div>1　小程序《隐私政策》需明示收集手机号用于「服务沟通与来源统计」，并取得用户同意（现有概括式勾选不符合要求，须先改造）</div>
              <div>2　本页限管理员角色访问；其他角色（运营、客服）强制脱敏为 138****6621</div>
              <div>3　查看与导出手机号须写入审计日志（操作人、时间、目标用户、用途），日志保留不少于 6 个月</div>
            </div>
            <div className="mt-2 text-xs" style={{ color: '#9A3412' }}>
              当前状态：手机号{MASK_PHONE ? '已脱敏展示（默认安全）' : '完整展示'}。三项前置条件全部完成后，将 page.tsx 顶部 MASK_PHONE 改为 false 即可切换。
            </div>
          </div>
        </>
      ) : null}

      {tab === 'history' ? (
        <>
          {/* 汇总数字 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatBox
              label={`访问会话（${rangeLabel}）`}
              value={historyAgg?.uv ?? 0}
              color={INK}
              hint={`广告 ${historyAgg?.adUv ?? 0} · 自然 ${historyAgg?.organicUv ?? 0}`}
            />
            <StatBox
              label="广告来源占比"
              value={`${pct(historyAgg?.adUv ?? 0, historyAgg?.uv ?? 0)}%`}
              color={BRAND}
              hint={`自然会话 ${pct(historyAgg?.organicUv ?? 0, historyAgg?.uv ?? 0)}%`}
            />
            <StatBox label="新用户" value={historyAgg?.newUser ?? 0} color={INK} />
            <StatBox label="留资" value={historyAgg?.leads ?? 0} color="#22A06B" />
            <StatBox
              label="筛选条件"
              value={`${src === 'mini' ? '小程序' : src === 'web' ? '官网' : '全部'} / ${ch === 'ad' ? '广告' : ch === 'organic' ? '自然' : '全部渠道'}`}
              color={SUB}
              hint={rangeLabel}
            />
          </div>

          {/* 来源汇总 */}
          <div className="rounded-xl border" style={{ background: '#fff', borderColor: LINE }}>
            <div className="border-b p-4 text-sm font-semibold" style={{ color: INK, borderColor: '#EEF1F5' }}>
              来源汇总　{rangeLabel}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#FAFBFD', color: MUTED, fontSize: 12 }}>
                    <th className="px-4 py-2 text-left font-medium">来源</th>
                    <th className="px-4 py-2 text-right font-medium">访问会话</th>
                    <th className="px-4 py-2 text-right font-medium">新用户</th>
                    <th className="px-4 py-2 text-right font-medium">留资</th>
                    <th className="px-4 py-2 text-right font-medium">留资率</th>
                  </tr>
                </thead>
                <tbody>
                  {historySourceRows.length ? (
                    historySourceRows.map((r) => (
                      <tr key={r.source} className="border-t" style={{ borderColor: '#F0F3F8' }}>
                        <td className="px-4 py-3" style={{ color: INK }}>{r.source}</td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: INK }}>{r.uv}</td>
                        <td className="px-4 py-3 text-right" style={{ color: SUB }}>{r.newUser}</td>
                        <td className="px-4 py-3 text-right" style={{ color: SUB }}>{r.leads}</td>
                        <td className="px-4 py-3 text-right" style={{ color: SUB }}>{r.rate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-xs" style={{ color: MUTED }}>
                        {rangeLabel}暂无访问记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-3 text-xs leading-5" style={{ borderColor: '#EEF1F5', color: MUTED }}>
              口径：来源以会话进入时是否携带 clickid 判定；同一会话多次上报按 visit_id 幂等覆盖，不重复计数；时间范围含当天，共 {rangeDays} 个自然日。
            </div>
          </div>

          {/* 历史明细 */}
          <div className="rounded-xl border" style={{ background: '#fff', borderColor: LINE }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: '#EEF1F5' }}>
              <h3 className="text-sm font-semibold" style={{ color: INK }}>访问明细　{rangeLabel}</h3>
              <span className="text-xs" style={{ color: MUTED }}>
                共 {historyTotal} 条　广告 {historyAgg?.adUv ?? 0}　自然 {historyAgg?.organicUv ?? 0}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#FAFBFD', color: MUTED }}>
                    <th className="px-4 py-2 text-left font-medium">时间</th>
                    <th className="px-4 py-2 text-left font-medium">用户</th>
                    <th className="px-4 py-2 text-left font-medium">来源端</th>
                    <th className="px-4 py-2 text-left font-medium">渠道</th>
                    <th className="px-4 py-2 text-left font-medium">来源</th>
                    <th className="px-4 py-2 text-left font-medium">落地页</th>
                    <th className="px-4 py-2 text-left font-medium">访问路径</th>
                    <th className="px-4 py-2 text-right font-medium">停留</th>
                    <th className="px-4 py-2 text-center font-medium">留资</th>
                    <th className="px-4 py-2 text-left font-medium">IP / 归属地</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.length ? (
                    historyRows.map((v) => {
                      const m = v.member
                      const who = m
                        ? m.nickname || m.name || (MASK_PHONE ? maskPhone(m.phone) : m.phone) || '会员'
                        : v.openid
                        ? `微信访客 ··${v.openid.slice(-4)}`
                        : '匿名访客'
                      const isMini = (v.path || '').startsWith('MINI:')
                      return (
                        <tr key={v.id} className="border-t" style={{ borderColor: '#F0F3F8' }}>
                          <td className="whitespace-nowrap px-4 py-3 font-mono" style={{ color: MUTED }}>
                            {fmtDT(v.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: m ? INK : MUTED }}>
                            {who}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                              style={{
                                background: isMini ? '#EEF2FF' : '#F1F5F9',
                                color: isMini ? '#4F46E5' : MUTED,
                              }}
                            >
                              {isMini ? '小程序' : '官网'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ChannelTag channel={v.channel} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: SUB }}>
                            {v.source || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: SUB }}>
                            {pageLabel(v.entryPage || v.path)}
                          </td>
                          <td className="px-4 py-3" style={{ color: MUTED }}>
                            {fmtPath(v.pathSeq)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right" style={{ color: SUB }}>
                            {fmtDur(v.duration)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {v.isLead ? (
                              <span className="font-medium" style={{ color: BRAND }}>已留资</span>
                            ) : (
                              <span style={{ color: MUTED }}>未留资</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <IpCell ip={v.ip} geo={v.geoClient} />
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-xs" style={{ color: MUTED }}>
                        {rangeLabel}暂无{src === 'mini' ? '小程序' : src === 'web' ? '官网' : ''}访问记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {historyTotal > PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: '#EEF1F5' }}>
                <span className="text-xs" style={{ color: MUTED }}>
                  共 {historyTotal} 条　每页 {PAGE_SIZE} 条　第 {page} / {historyTotalPages} 页
                </span>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={historyHref({ page: page - 1 })}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: '#F4F6FA', color: SUB }}
                    >
                      上一页
                    </Link>
                  ) : null}
                  {page < historyTotalPages ? (
                    <Link
                      href={historyHref({ page: page + 1 })}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: '#F4F6FA', color: INK }}
                    >
                      下一页
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
