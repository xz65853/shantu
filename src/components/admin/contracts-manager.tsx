'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, FileText, Pencil, Ban, Trash2, X } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { DeleteDialog } from './delete-dialog'

export type ContractRow = {
  id: number
  contractNo: string | null
  name: string
  phone: string
  packageName: string
  orderNo: string
  amount: number
  status: string
  orderStatus: string
  signedAt: string | null
  pdfUrl: string | null
  memberCancelled?: boolean
}

type ContractDetail = {
  id: number
  contractNo: string | null
  partyAName: string
  partyAPhone: string
  packageName: string
  orderNo: string
  amount: number
  amountText: string
  servicesJson: string[]
  terms: string
  periodStart: string
  periodEnd: string
  serviceDays: number | null
  status: string
  statusText: string
  orderStatus: string
  signedAt: string | null
  pdfUrl: string | null
  version: number
}

type Version = {
  version: number
  adminName: string | null
  changesJson: string | null
  remark: string | null
  createdAt: string
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '待签署', cls: 'bg-red-50 text-red-600' },
  SIGNED: { label: '已签署', cls: 'bg-green-50 text-green-700' },
  VOID: { label: '已作废', cls: 'bg-slate-100 text-slate-500' },
}

const ORDER_STATUS: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function ContractsManager({ initial }: { initial: ContractRow[] }) {
  const [rows, setRows] = useState<ContractRow[]>(initial)
  const [filter, setFilter] = useState('ALL')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<ContractDetail | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ContractRow | null>(null)

  // 附加条款库与已勾选条款（快照进合同 clauses_json，不影响模板）
  const [clauseLib, setClauseLib] = useState<{ id: number; name: string; content: string }[]>([])
  const [selectedClauses, setSelectedClauses] = useState<{ name: string; content: string }[]>([])

  // 编辑态（待签署）
  const [draft, setDraft] = useState<{
    partyAName: string
    partyAPhone: string
    servicesText: string
    amountYuan: string
    periodStart: string
    periodEnd: string
    terms: string
  } | null>(null)

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'ALL') params.set('status', filter)
      if (keyword) params.set('keyword', keyword)
      const res = await fetch(`/api/admin/contracts?${params}`)
      const json = await res.json()
      if (json.code === 0) setRows(json.data.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    fetch('/api/admin/contract-clauses')
      .then((r) => r.json())
      .then((j) => {
        if (j.code === 0) setClauseLib(j.data.list || [])
      })
      .catch(() => undefined)
  }, [])

  async function openDetail(id: number) {
    setDraft(null)
    const res = await fetch(`/api/admin/contracts/${id}`)
    const json = await res.json()
    if (json.code !== 0) return notify(json.message || '加载失败')
    setDetail(json.data.contract)
    setVersions(json.data.versions || [])
    const c = json.data.contract
    setDraft({
      partyAName: c.partyAName,
      partyAPhone: c.partyAPhone,
      servicesText: (c.servicesJson || []).join('\n'),
      amountYuan: String(c.amount / 100),
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      terms: c.terms || '',
    })
    setSelectedClauses(Array.isArray((c as { clauses?: { name: string; content: string }[] }).clauses) ? (c as { clauses: { name: string; content: string }[] }).clauses : [])
  }

  async function save() {
    if (!detail || !draft) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/contracts/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyAName: draft.partyAName,
          partyAPhone: draft.partyAPhone,
          servicesJson: draft.servicesText.split('\n').map((s) => s.trim()).filter(Boolean),
          amount: Math.round(Number(draft.amountYuan || 0) * 100),
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          terms: draft.terms,
          clauses: selectedClauses,
        }),
      })
      const json = await res.json()
      if (json.code !== 0) return notify(json.message || '保存失败')
      notify('已保存并重新生成 PDF')
      await load()
      await openDetail(detail.id)
    } finally {
      setSaving(false)
    }
  }

  async function voidContract(id: number, label: string) {
    if (!confirm(`确定作废合同 ${label}？此操作会留痕。`)) return
    const res = await fetch(`/api/admin/contracts/${id}/void`, { method: 'POST' })
    const json = await res.json()
    if (json.code !== 0) return notify(json.message || '操作失败')
    notify('已作废')
    await load()
  }

  function openPdf(id: number) {
    window.open(`/api/admin/contracts/${id}/pdf`, '_blank')
  }

  const editable = detail && detail.status === 'PENDING' && detail.orderStatus !== 'PAID'

  return (
    <div className="space-y-4">
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: 'ALL', label: '全部' },
          { v: 'PENDING', label: '待签署' },
          { v: 'SIGNED', label: '已签署' },
          { v: 'VOID', label: '已作废' },
        ].map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setFilter(t.v)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm transition',
              filter === t.v ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:border-brand-200',
            )}
          >
            {t.label}
          </button>
        ))}
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              className="field w-56 pl-8"
              placeholder="合同号 / 客户 / 手机号 / 套餐"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">
            搜索
          </button>
        </form>
      </div>

      {/* 列表 */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">合同编号</th>
              <th className="px-4 py-3 font-medium">客户</th>
              <th className="px-4 py-3 font-medium">套餐</th>
              <th className="px-4 py-3 font-medium">金额</th>
              <th className="px-4 py-3 font-medium">签署状态</th>
              <th className="px-4 py-3 font-medium">订单状态</th>
              <th className="px-4 py-3 font-medium">签署时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-slate-400">暂无合同</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-mist/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.contractNo || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {r.memberCancelled ? <span className="mr-1 text-slate-400">[已注销]</span> : null}
                      {r.name || '未命名'}
                    </p>
                    <p className="text-xs text-slate-400">{r.phone || '无手机号'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.packageName || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-ink">¥{yuan(r.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500')}>
                      {STATUS[r.status]?.label || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{ORDER_STATUS[r.orderStatus] || r.orderStatus || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.signedAt ? formatDate(r.signedAt, true) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDetail(r.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                      >
                        <Pencil className="h-3.5 w-3.5" /> 详情/编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => openPdf(r.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                      >
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </button>
                      {r.status !== 'VOID' ? (
                        <button
                          type="button"
                          onClick={() => voidContract(r.id, r.contractNo || r.orderNo)}
                          className="inline-flex items-center gap-1 rounded-full border border-line p-1.5 text-slate-400 transition hover:border-red-200 hover:text-red-600"
                          title="作废合同"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (r.status === 'SIGNED') return
                          setDeleteTarget(r)
                        }}
                        disabled={r.status === 'SIGNED'}
                        title={r.status === 'SIGNED' ? '已签合同不能删除' : '删除合同'}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border p-1.5 transition',
                          r.status === 'SIGNED'
                            ? 'cursor-not-allowed border-line text-slate-300'
                            : 'border-line text-slate-400 hover:border-red-200 hover:text-red-600',
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 详情/编辑弹窗 */}
      {detail ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lift">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  合同详情 {detail.contractNo ? `· ${detail.contractNo}` : ''}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {detail.orderNo} · v{detail.version}
                  <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs', STATUS[detail.status]?.cls)}>
                    {detail.statusText}
                  </span>
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!editable ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                已签署/已支付合同只读，不可修改（法律效力），仅可作废。
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                待签署合同可编辑，保存后自动重新生成 PDF。
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">客户姓名</label>
                <input className="field" disabled={!editable} value={draft?.partyAName || ''} onChange={(e) => setDraft({ ...draft!, partyAName: e.target.value })} />
              </div>
              <div>
                <label className="label">手机号</label>
                <input className="field" disabled={!editable} value={draft?.partyAPhone || ''} onChange={(e) => setDraft({ ...draft!, partyAPhone: e.target.value })} />
              </div>
              <div>
                <label className="label">金额（元）</label>
                <input className="field" disabled={!editable} type="number" value={draft?.amountYuan || ''} onChange={(e) => setDraft({ ...draft!, amountYuan: e.target.value })} />
              </div>
              <div>
                <label className="label">套餐</label>
                <input className="field" disabled value={detail.packageName} />
              </div>
              <div>
                <label className="label">开始日期</label>
                <input className="field" disabled={!editable} value={draft?.periodStart || ''} onChange={(e) => setDraft({ ...draft!, periodStart: e.target.value })} placeholder="如 2026年09月28日" />
              </div>
              <div>
                <label className="label">结束日期</label>
                <input className="field" disabled={!editable} value={draft?.periodEnd || ''} onChange={(e) => setDraft({ ...draft!, periodEnd: e.target.value })} placeholder="如 2026年10月28日" />
              </div>
            </div>

            <div className="mt-3">
              <label className="label">服务内容清单（每行一条）</label>
              <textarea
                className="field min-h-[160px] font-mono text-sm"
                disabled={!editable}
                value={draft?.servicesText || ''}
                onChange={(e) => setDraft({ ...draft!, servicesText: e.target.value })}
              />
            </div>

            <div className="mt-3">
              <label className="label">补充条款（追加约定）</label>
              <textarea
                className="field min-h-[80px]"
                disabled={!editable}
                value={draft?.terms || ''}
                onChange={(e) => setDraft({ ...draft!, terms: e.target.value })}
                placeholder="如：额外赠送 2 条探店视频"
              />
            </div>

            {clauseLib.length > 0 ? (
              <div className="mt-3">
                <label className="label">附加条款（勾选后进入合同「其他约定」）</label>
                <div className="mt-1 max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-line p-2">
                  {clauseLib.map((cl) => {
                    const checked = selectedClauses.some((x) => x.name === cl.name)
                    return (
                      <label key={cl.id} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          disabled={!editable}
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClauses((prev) => [...prev, { name: cl.name, content: cl.content }])
                            } else {
                              setSelectedClauses((prev) => prev.filter((x) => x.name !== cl.name))
                            }
                          }}
                        />
                        <span className="flex-1">
                          <span className="font-medium text-slate-700">{cl.name}</span>
                          <span className="block text-xs leading-relaxed text-slate-500">{cl.content}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {!editable ? (
                  <p className="mt-1 text-xs text-slate-400">已签署或已支付的合同不可修改附加条款。</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => openPdf(detail.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-4 py-2 text-sm text-slate-600 hover:border-brand-200 hover:text-brand-700"
              >
                <FileText className="h-4 w-4" /> 预览 PDF
              </button>
              <div className="flex gap-2">
                {detail.status !== 'VOID' ? (
                  <button
                    type="button"
                    onClick={() => voidContract(detail.id, detail.contractNo || detail.orderNo)}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    作废
                  </button>
                ) : null}
                {editable ? (
                  <button type="button" onClick={save} disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存并重新生成 PDF
                  </button>
                ) : null}
              </div>
            </div>

            {/* 版本记录 */}
            {versions.length > 0 ? (
              <div className="mt-5 border-t border-line pt-3">
                <p className="text-xs font-medium text-slate-500">版本记录（只读）</p>
                <ul className="mt-2 space-y-1.5">
                  {versions.map((v) => (
                    <li key={v.version} className="text-xs text-slate-500">
                      <span className="font-medium text-ink">v{v.version}</span>
                      <span className="mx-1">·</span>
                      {v.adminName || '系统'}
                      <span className="mx-1">·</span>
                      {formatDate(v.createdAt, true)}
                      {v.remark ? <span className="mx-1 text-red-500">{v.remark}</span> : null}
                      {v.changesJson ? (
                        <span className="ml-1 text-slate-400">{summarize(v.changesJson)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          type="contract"
          id={deleteTarget.id}
          info={`${deleteTarget.contractNo || deleteTarget.orderNo}（${deleteTarget.name}）`}
          onClose={() => setDeleteTarget(null)}
          onDone={() => load()}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function summarize(changesJson: string): string {
  try {
    const arr = JSON.parse(changesJson)
    if (Array.isArray(arr)) return arr.map((c) => c.field).join('、')
  } catch {
    /* ignore */
  }
  return ''
}
