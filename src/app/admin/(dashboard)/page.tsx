import Link from 'next/link'
import { sanitizeName } from '@/lib/name-utils';
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { AiBriefCard } from '@/components/admin/ai-brief-card'
import { StatCardWithHint } from '@/components/admin/stat-card-with-hint'
import { pageLabel } from '@/lib/mini-path'
import { regionLabel } from '@/lib/ip-region'

export const dynamic = 'force-dynamic'

const BRAND = '#3B6EF5'

export default async function AdminDashboard() {
  await requireAdmin()

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    todayVisits,
    todayLeads,
    pendingLeads,
    pendingOrders,
    paidOrders,
    pendingContracts,
    activeProjects,
    recentOrders,
    recentContracts,
    todayAdClicks,
    todayAdLeads,
    todayAdOrders,
    todayNewMembers,
    todayAdMembers,
    todayOrganicMembers,
    recentVisits,
  ] = await Promise.all([
    prisma.visitLog.count({ where: { createdAt: { gte: startOfToday } } }).catch(() => 0),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday }, deletedAt: null } }).catch(() => 0),
    prisma.lead.count({ where: { status: 'PENDING', deletedAt: null } }).catch(() => 0),
    prisma.order.count({ where: { status: 'PENDING', deletedAt: null } }).catch(() => 0),
    prisma.order.count({ where: { status: 'PAID', deletedAt: null } }).catch(() => 0),
    prisma.contract.count({ where: { status: 'PENDING', deletedAt: null } }).catch(() => 0),
    prisma.project.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.order.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 6 }).catch(() => []),
    prisma.contract.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 4 }).catch(() => []),
    prisma.adClick.count({ where: { createdAt: { gte: startOfToday } } }).catch(() => 0),
    prisma.adClick.count({ where: { createdAt: { gte: startOfToday }, isConverted: true } }).catch(() => 0),
    prisma.adClick.count({ where: { createdAt: { gte: startOfToday }, isOrdered: true } }).catch(() => 0),
    // 广告/自然来源：按今日访问流水的渠道统计（与访问分析口径一致）
    prisma.member.count({ where: { createdAt: { gte: startOfToday }, deletedAt: null } }).catch(() => 0),
    prisma.visitLog.count({ where: { createdAt: { gte: startOfToday }, channel: 'ad' } }).catch(() => 0),
    prisma.visitLog.count({ where: { createdAt: { gte: startOfToday }, channel: 'organic' } }).catch(() => 0),
    // 最近访问流水（关联会员）
    prisma.visitLog.findMany({
      where: { createdAt: { gte: startOfToday } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { member: { select: { nickname: true, name: true, phone: true } } },
    }).catch(() => []),
  ])

  // 今日待办 = 今日订单 + 待跟进线索 + 待签合同
  const todayTodos = pendingOrders + pendingLeads + pendingContracts
  // 异常提醒 = 待支付订单
  const alerts = pendingOrders

  const quickStats = [
    { label: '今日待办', value: todayTodos, color: '#E5544B', bar: Math.min(100, todayTodos * 8), icon: 'clipboard' },
    { label: '待签合同', value: pendingContracts, color: BRAND, bar: Math.min(100, pendingContracts * 12), icon: 'doc' },
    { label: '进行中项目', value: activeProjects, color: '#E8A33D', bar: Math.min(100, activeProjects * 6), icon: 'folder' },
    { label: '异常提醒', value: alerts, color: '#7C6FF0', bar: Math.min(100, alerts * 15), icon: 'bell' },
  ]

  const tagFilters = [
    { label: '全部待办', href: '/admin' },
    { label: `待支付订单 ${pendingOrders}`, href: '/admin/orders' },
    { label: `待签合同 ${pendingContracts}`, href: '/admin/contracts' },
    { label: `进行项目 ${activeProjects}`, href: '/admin/projects' },
    { label: `待跟进线索 ${pendingLeads}`, href: '/admin/leads' },
  ]

  function iconSvg(type: string) {
    const common = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
    switch (type) {
      case 'clipboard': return `<svg ${common}><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`
      case 'doc': return `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`
      case 'folder': return `<svg ${common}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`
      default: return `<svg ${common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`
    }
  }

  return (
    <div className="space-y-4">
      {/* 顶部待办中心标签行 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
        <span className="text-sm font-semibold" style={{ color: '#1E2A3B' }}>待办中心</span>
        {tagFilters.map((t, i) => (
          <Link
            key={i}
            href={t.href}
            className="rounded-full px-3 py-1.5 text-xs transition hover:opacity-80"
            style={{
              background: i === 0 ? '#EAF1FE' : '#F4F6FA',
              color: i === 0 ? BRAND : '#5B6B82',
              fontWeight: i === 0 ? 500 : 400,
            }}
          >
            {t.label}
          </Link>
        ))}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: '#F4F6FA', color: '#9AA7B8' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
            搜索客户、订单、合同
          </div>
          <Link href="/admin/orders" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: BRAND }}>
            新建订单
          </Link>
        </div>
      </div>

      <AiBriefCard />

      {/* 4个数据卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickStats.map((s, i) => (
          <StatCardWithHint key={i} label={s.label} value={s.value} color={s.color} bar={s.bar} icon={iconSvg(s.icon)} context={JSON.stringify({ pendingOrders, activeOrders: pendingOrders + paidOrders, pendingContracts, activeProjects, pendingLeads })} />
        ))}
      </div>

      {/* 广告监测数据 */}
      <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: '#1E2A3B' }}>广告投放</h3>
          <Link href="/admin/ad-stats" className="text-xs" style={{ color: BRAND }}>详情 ▾</Link>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>{todayAdClicks}</div>
            <div className="text-xs mt-1" style={{ color: '#9AA7B8' }}>今日点击</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#22A06B' }}>{todayAdLeads}</div>
            <div className="text-xs mt-1" style={{ color: '#9AA7B8' }}>今日留资</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: BRAND }}>{todayAdOrders}</div>
            <div className="text-xs mt-1" style={{ color: '#9AA7B8' }}>今日订单</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>{todayNewMembers}</div>
            <div className="text-xs mt-1" style={{ color: '#9AA7B8' }}>今日新增会员</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#E8A33D' }}>{todayAdMembers}</div>
            <div className="text-xs mt-1" style={{ color: '#9AA7B8' }}>广告来源</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#5B6B82' }}>{todayOrganicMembers}</div>
            <div className="text-xs mt-1" style={{ color: '#9AA7B8' }}>自然来源</div>
          </div>
        </div>
      </div>

      {/* 实时访问流水 */}
      <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: '#1E2A3B' }}>今日访问流水</h3>
          <span className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#9AA7B8' }}>最近 {recentVisits.length} 条</span>
            <Link href="/admin/visits?tab=flow" className="text-xs" style={{ color: BRAND }}>详情 ▾</Link>
          </span>
        </div>
        {recentVisits.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: '#9AA7B8' }}>
                  <th className="py-1.5 text-left font-medium pr-3">时间</th>
                  <th className="py-1.5 text-left font-medium pr-3">会员</th>
                  <th className="py-1.5 text-left font-medium pr-3">来源端</th>
                  <th className="py-1.5 text-left font-medium pr-3">渠道</th>
                  <th className="py-1.5 text-left font-medium pr-3">路径</th>
                  <th className="py-1.5 text-left font-medium pr-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {recentVisits.map((v) => (
                  <tr key={v.id} className="border-t" style={{ borderColor: '#F0F3F8' }}>
                    <td className="py-2 pr-3 font-mono" style={{ color: '#9AA7B8' }}>{formatDate(v.createdAt, true)}</td>
                    <td className="py-2 pr-3" style={{ color: '#1E2A3B' }}>
                      {v.member
                        ? (v.member.nickname || v.member.name || (v.member.phone ? v.member.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '会员'))
                        : v.openid
                        ? `微信访客 ··${v.openid.slice(-4)}`
                        : '匿名访客'}
                    </td>
                    <td className="py-2 pr-3">
                      {(v.path || '').startsWith('MINI:') ? (
                        <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: '#EEF2FF', color: '#4F46E5' }}>小程序</span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: '#F1F5F9', color: '#9AA7B8' }}>官网</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {v.channel === 'ad' ? (
                        <span className="rounded-full px-2 py-0.5 text-[11px] text-white" style={{ background: BRAND }}>广告</span>
                      ) : v.channel === 'organic' ? (
                        <span className="rounded-full px-2 py-0.5 text-[11px] text-white" style={{ background: '#38BDF8' }}>自然</span>
                      ) : (
                        <span className="text-[11px]" style={{ color: '#9AA7B8' }}>—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3" style={{ color: '#5B6B82' }}>{pageLabel(v.path)}</td>
                    <td className="py-2 pr-3">
                      {v.ip ? (
                        <>
                          {(regionLabel(v.ip, v.geoClient)) ? (
                            <span style={{ color: '#5B6B82' }}>{regionLabel(v.ip, v.geoClient)} </span>
                          ) : null}
                          <span className="font-mono" style={{ color: '#9AA7B8' }}>{v.ip}</span>
                        </>
                      ) : (
                        <span style={{ color: '#9AA7B8' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-xs" style={{ color: '#9AA7B8' }}>今日暂无访问记录</div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* 主区：任务看板 */}
        <div className="rounded-xl border" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
          <div className="flex items-center gap-4 border-b px-4 py-3" style={{ borderColor: '#E8ECF2' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1E2A3B' }}>任务看板</h3>
            <div className="flex gap-3 text-xs" style={{ color: '#9AA7B8' }}>
              <span style={{ color: BRAND, borderBottom: `2px solid ${BRAND}`, paddingBottom: 4 }}>订单</span>
              <Link href="/admin/contracts" className="hover:text-slate-600">合同</Link>
              <Link href="/admin/leads" className="hover:text-slate-600">客户</Link>
            </div>
            <Link href="/admin/orders" className="ml-auto text-xs" style={{ color: BRAND }}>查看 ▾</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#FAFBFD', color: '#9AA7B8', fontSize: 12 }}>
                <th className="px-4 py-2 text-left font-medium">状态</th>
                <th className="px-4 py-2 text-left font-medium">订单号</th>
                <th className="px-4 py-2 text-left font-medium">套餐</th>
                <th className="px-4 py-2 text-left font-medium">客户</th>
                <th className="px-4 py-2 text-left font-medium">金额</th>
                <th className="px-4 py-2 text-left font-medium">下单时间</th>
                <th className="px-4 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length ? recentOrders.map((o) => (
                <tr key={o.id} className="border-t" style={{ borderColor: '#F0F3F8' }}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: o.status === 'PAID' ? '#22A06B' : '#E8A33D' }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.status === 'PAID' ? '#22A06B' : '#E8A33D' }} />
                      {o.status === 'PAID' ? '已支付' : o.status === 'PENDING' ? '待支付' : o.status === 'CANCELLED' ? '已取消' : '已退款'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#5B6B82' }}>{o.orderNo}</td>
                  <td className="px-4 py-3" style={{ color: '#1E2A3B' }}>{o.packageName}</td>
                  <td className="px-4 py-3" style={{ color: '#5B6B82' }}>{sanitizeName(o.name)}</td>
                  <td className="px-4 py-3" style={{ color: '#1E2A3B' }}>¥{(o.amount / 100).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9AA7B8' }}>{formatDate(o.createdAt, true)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href="/admin/orders" className="text-xs" style={{ color: BRAND }}>查看</Link>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xs" style={{ color: '#9AA7B8' }}>暂无订单</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 右侧栏 */}
        <div className="space-y-4">
          {/* 任务状态概览环形图 */}
          <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1E2A3B' }}>任务状态概览</h3>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F0F3F8" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={BRAND} strokeWidth="3.5"
                    strokeDasharray={`${Math.min(100, (paidOrders / Math.max(1, paidOrders + pendingOrders)) * 100)} 100`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: '#1E2A3B' }}>
                  {paidOrders}
                </div>
              </div>
              <div className="space-y-1.5 text-xs" style={{ color: '#5B6B82' }}>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: BRAND }} />已支付 {paidOrders}</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: '#E8A33D' }} />待支付 {pendingOrders}</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: '#F0F3F8' }} />待签合同 {pendingContracts}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { label: '新待办', color: '#E5544B', href: '/admin/orders' },
                { label: '建订单', color: '#E8A33D', href: '/admin/orders' },
                { label: '看日报', color: '#8A97AB', href: '/admin/projects' },
                { label: '套餐', color: '#22A06B', href: '/admin/packages' },
              ].map((q, i) => (
                <Link key={i} href={q.href} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: q.color }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                  </div>
                  <span className="text-[11px]" style={{ color: '#5B6B82' }}>{q.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* 最近动态 */}
          <div className="rounded-xl border p-4" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1E2A3B' }}>最近动态</h3>
            <div className="mt-3 space-y-2.5">
              {recentOrders.slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND }} />
                  <span className="flex-1 truncate" style={{ color: '#5B6B82' }}>创建订单 {o.orderNo.slice(-6)}</span>
                  <span style={{ color: '#9AA7B8' }}>{formatDate(o.createdAt, true)}</span>
                </div>
              ))}
              {recentContracts.slice(0, 2).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ color: '#22A06B', background: '#22A06B' }} />
                  <span className="flex-1 truncate" style={{ color: '#5B6B82' }}>合同 {c.contractNo || `#${c.id}`} {c.status === 'SIGNED' ? '已签署' : '待签署'}</span>
                </div>
              ))}
              {!recentOrders.length && !recentContracts.length && (
                <p className="py-4 text-center text-xs" style={{ color: '#9AA7B8' }}>暂无动态</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
