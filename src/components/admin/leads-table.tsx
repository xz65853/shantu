'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { LeadStatusBadge, LEAD_STATUS_LABEL } from './lead-status'
import { formatDate, parseJsonArray } from '@/lib/utils'
import { DeleteDialog } from './delete-dialog'

export type LeadRow = {
  id: number
  name: string
  phone: string
  company: string | null
  city: string | null
  industry: string | null
  requirements: string | null
  source: string | null
  sourcePage: string | null
  status: string
  createdAt: string
}

const FILTERS = [
  { key: 'ALL', label: '全部' },
  ...Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => ({ key, label })),
]

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState('ALL')
  const [keyword, setKeyword] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [delTarget, setDelTarget] = useState<LeadRow | null>(null)

  const filtered = rows.filter((row) => {
    if (filter !== 'ALL' && row.status !== filter) return false
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      const hay = `${row.name}${row.phone}${row.company || ''}${row.city || ''}${row.industry || ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })

  async function changeStatus(id: number, status: string) {
    setBusyId(id)
    try {
      await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                filter === f.key
                  ? 'border-ink bg-ink text-white'
                  : 'border-line text-slate-600 hover:border-brand-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            className="field py-2 pl-9 text-xs"
            placeholder="搜索姓名 / 手机号 / 公司"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">客户</th>
              <th className="px-5 py-3 font-medium">公司 / 行业</th>
              <th className="px-5 py-3 font-medium">需求</th>
              <th className="px-5 py-3 font-medium">来源</th>
              <th className="px-5 py-3 font-medium">提交时间</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length ? (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-mist/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{row.name}</div>
                    <div className="text-xs text-slate-400">{row.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <div>{row.company || '-'}</div>
                    <div className="text-xs text-slate-400">{row.industry || ''}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {parseJsonArray(row.requirements).join(' · ') || '-'}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {row.sourcePage || row.source || '-'}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(row.createdAt, true)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {busyId === row.id ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : null}
                      <select
                        className="rounded-md border border-line bg-white px-2 py-1 text-xs"
                        value={row.status}
                        onChange={(e) => changeStatus(row.id, e.target.value)}
                      >
                        {Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span className="mr-1">
                        <LeadStatusBadge status={row.status} />
                      </span>
                      <Link
                        href={`/admin/leads/${row.id}`}
                        className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700"
                      >
                        详情
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDelTarget(row)}
                        className="rounded-md border border-line p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
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
                <td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400">
                  暂无符合条件的客户线索
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {delTarget ? (
        <DeleteDialog
          type="lead"
          id={delTarget.id}
          info={`${delTarget.name}（${delTarget.phone}）`}
          onClose={() => setDelTarget(null)}
          onDone={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}
