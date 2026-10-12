'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, Trash2, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeleteDialog } from './delete-dialog'
import { sanitizeName } from '@/lib/name-utils';
import { WatermarkOverlay } from '@/components/watermark-overlay'

export type OrderRow = {
  id: number
  orderNo: string
  packageName: string
  period: string
  amount: number
  status: string
  memberId: number | null
  payMethod: string | null
  name: string
  phone: string
  company: string | null
  city: string | null
  industry: string | null
  remark: string | null
  source: string | null
  realName: string | null
  createdAt: string
  paidAt: string | null
  memberCancelled?: boolean
  member?: { realName: string | null; isRealVerified: boolean; realVerifiedAt: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
  REFUNDED: 'bg-slate-100 text-slate-500',
}

const PAY_LABEL: Record<string, string> = {
  WECHAT: '微信支付',
  ALIPAY: '支付宝',
  OFFLINE: '线下对接',
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

export function OrdersManager({
  initial,
  stats,
}: {
  initial: OrderRow[]
  stats: { PENDING: number; PAID: number; paidAmount: number }
}) {
  const [rows, setRows] = useState<OrderRow[]>(initial)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<OrderRow | null>(null)
  const [delTarget, setDelTarget] = useState<OrderRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [orderWmOn, setOrderWmOn] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/admin/watermark')
      .then((r) => r.json())
      .then((j) => { if (j?.code === 0 && j?.data?.order_wm_enable !== '0') setOrderWmOn(true) })
      .catch(() => {})
  }, [])

  async function load(nextStatus = status, nextKeyword = keyword) {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (nextStatus) qs.set('status', nextStatus)
      if (nextKeyword) qs.set('keyword', nextKeyword)
      const res = await fetch(`/api/admin/orders?${qs.toString()}`).then((r) => r.json())
      if (res?.code === 0) setRows(res.data.list)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(row: OrderRow, next: string, payMethod?: string | null) {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/orders/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, payMethod: payMethod ?? row.payMethod }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setMessage(json.message || '更新失败')
        return
      }
      setMessage('订单已更新')
      setDetail(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function syncPay(row: OrderRow) {
    setSyncing(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/orders/${row.id}/sync-pay`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setMessage(json.message || '同步失败')
        return
      }
      setMessage(json.message || '同步完成')
      await load()
      // 刷新弹窗内详情：拉最新订单行
      const freshest = await fetch(`/api/admin/orders?keyword=${encodeURIComponent(row.orderNo)}`).then((r) => r.json())
      if (freshest?.code === 0 && freshest.data?.list?.length) {
        setDetail(freshest.data.list[0])
      }
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 统计 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="admin-stats-card">
          <div className="text-xs text-slate-400">待支付订单</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{stats.PENDING}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-xs text-slate-400">已支付订单</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{stats.PAID}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-xs text-slate-400">已支付金额</div>
          <div className="mt-1 text-2xl font-semibold text-ink">¥{yuan(stats.paidAmount)}</div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {[
            { value: '', label: '全部' },
            { value: 'PENDING', label: '待支付' },
            { value: 'PAID', label: '已支付' },
            { value: 'CANCELLED', label: '已取消' },
            { value: 'REFUNDED', label: '已退款' },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setStatus(s.value)
                load(s.value, keyword)
              }}
              className={cn(
                'admin-filter-btn',
                status === s.value
                  ? 'active'
                  : 'bg-white text-slate-600 hover:bg-brand-50 hover:text-brand-700',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2">
          <input
            className="field max-w-xs"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(status, keyword)}
            placeholder="订单号 / 姓名 / 手机号 / 公司"
          />
          <button onClick={() => load(status, keyword)} className="btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            搜索
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>
      ) : null}

      {/* 列表 */}
      <div className="admin-table-wrap">
        <table className="admin-table w-full min-w-[880px] text-sm">
          <thead className="border-b border-line bg-mist text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">订单号</th>
              <th className="px-4 py-3 font-medium">套餐</th>
              <th className="px-4 py-3 font-medium">金额</th>
              <th className="px-4 py-3 font-medium">客户</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">下单时间</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.orderNo}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2"><span className="text-ink">{r.packageName}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{r.period}</span></div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">¥{yuan(r.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink">
                      {r.memberCancelled ? <span className="mr-1 text-slate-400">[已注销]</span> : null}
                      {sanitizeName(r.name)}
                    </div>
                    <div className="text-xs text-slate-400">{r.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_STYLE[r.status])}
                    >
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                    {r.payMethod ? (
                      <div className="mt-0.5 text-xs text-slate-400">
                        {PAY_LABEL[r.payMethod] || r.payMethod}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setDetail(r)}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-slate-600 hover:border-brand-200 hover:text-brand-700"
                      >
                        详情
                      </button>
                      <button
                        onClick={() => setDelTarget(r)}
                        disabled={r.status === 'PAID'}
                        title={r.status === 'PAID' ? '已支付订单不能删除，请先退款' : '删除'}
                        className="rounded-lg border border-line p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  暂无订单
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 详情弹窗 */}
      {detail ? (
        <>
        {orderWmOn ? (
          <WatermarkOverlay
            text={`${detail.name || '客户'} ${(detail.phone || '').slice(-4)}`}
            color="#c0c0c0"
            opacity={0.15}
            fontSize={12}
            zIndex={60}
          />
        ) : null}
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lift">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">订单详情</h2>
                <div className="mt-0.5 font-mono text-xs text-slate-400">{detail.orderNo}</div>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-ink">
                关闭
              </button>
            </div>

            <dl className="mt-5 space-y-2.5 text-sm">
              {[
                ['套餐', `${detail.packageName} / ${detail.period}`],
                ['金额', `¥${yuan(detail.amount)}`],
                ['客户', detail.name],
                ['手机号', detail.phone],
                ['实名认证', detail.member?.isRealVerified ? `已实名 · ${detail.member.realName || detail.realName || '已认证'}` : '未实名'],
                ['公司', detail.company || '—'],
                ['城市', detail.city || '—'],
                ['行业', detail.industry || '—'],
                ['来源', detail.source || '—'],
                ['下单时间', fmtDate(detail.createdAt)],
                ['支付时间', fmtDate(detail.paidAt)],
                ['备注', detail.remark || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="shrink-0 text-slate-400">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {detail.memberId ? (
              <div className="mt-4 rounded-lg bg-brand-50/60 px-3 py-2.5">
                <a
                  href={`/admin/members?keyword=${encodeURIComponent(detail.phone)}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                >
                  查看会员档案 →
                </a>
                <span className="ml-2 text-xs text-slate-400">该订单已关联会员</span>
              </div>
            ) : null}

            {detail.status === 'PENDING' ? (
              <div className="mt-5">
                <div className="text-xs text-slate-400">支付状态</div>
                <button
                  onClick={() => syncPay(detail)}
                  disabled={syncing}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                  同步支付状态
                </button>
                <span className="ml-2 text-xs text-slate-400">主动向微信查询最新支付结果</span>
              </div>
            ) : null}

            <div className="mt-5">
              <div className="text-xs text-slate-400">修改状态</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'].map((s) => (
                  <button
                    key={s}
                    disabled={saving || detail.status === s}
                    onClick={() =>
                      updateStatus(
                        detail,
                        s,
                        s === 'PAID' ? detail.payMethod || 'OFFLINE' : detail.payMethod,
                      )
                    }
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs transition',
                      detail.status === s
                        ? 'bg-slate-100 text-slate-400'
                        : 'border border-line text-slate-600 hover:border-brand-200 hover:text-brand-700',
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        </>
      ) : null}

      {delTarget ? (
        <DeleteDialog
          type="order"
          id={delTarget.id}
          info={`${delTarget.orderNo}（${delTarget.name}）`}
          onClose={() => setDelTarget(null)}
          onDone={() => load()}
        />
      ) : null}
    </div>
  )
}
