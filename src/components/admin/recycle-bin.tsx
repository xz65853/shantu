'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw, Trash2, X } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

type Row = {
  id: number
  key: string
  label: string
  phone: string | null
  extra: string
  status: string
  deletedAt: string
  deletedBy: number | null
  deleteReason: string | null
  deletedByName: string | null
}

const TABS = [
  { v: 'order', label: '订单回收站' },
  { v: 'member', label: '会员回收站' },
  { v: 'lead', label: '线索回收站' },
  { v: 'contract', label: '合同回收站' },
]

export function RecycleBin() {
  const [type, setType] = useState('order')
  const [list, setList] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(0)
  const [purgeTarget, setPurgeTarget] = useState<Row | null>(null)
  const [toast, setToast] = useState('')

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async (t = type) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/recycle?type=${t}`)
      const json = await res.json()
      if (json.code === 0) {
        setList(json.data.list)
        setTotal(json.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    load(type)
  }, [type, load])

  async function restore(row: Row) {
    setBusyId(row.id)
    try {
      const res = await fetch('/api/admin/recycle/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id: row.id }),
      })
      const json = await res.json()
      notify(json.message || '操作失败')
      if (json.code === 0) await load()
    } finally {
      setBusyId(0)
    }
  }

  async function confirmPurge() {
    if (!purgeTarget) return
    setBusyId(purgeTarget.id)
    try {
      const res = await fetch('/api/admin/recycle/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id: purgeTarget.id }),
      })
      const json = await res.json()
      notify(json.message || '操作失败')
      setPurgeTarget(null)
      if (json.code === 0) await load()
    } finally {
      setBusyId(0)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setType(t.v)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm transition',
              type === t.v ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:border-brand-200',
            )}
          >
            {t.label}
            {t.v === type ? `（${total}）` : ''}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">回收站为空</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">对象</th>
                <th className="px-4 py-3 font-medium">手机号</th>
                <th className="px-4 py-3 font-medium">附加信息</th>
                <th className="px-4 py-3 font-medium">删除时间</th>
                <th className="px-4 py-3 font-medium">删除人</th>
                <th className="px-4 py-3 font-medium">原因</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className="transition hover:bg-mist/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.label || '—'}</p>
                    <p className="text-xs text-slate-400">{r.key}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.extra || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.deletedAt ? formatDate(r.deletedAt, true) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.deletedByName || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.deleteReason || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {type !== 'member' ? (
                        <button
                          type="button"
                          onClick={() => restore(r)}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-brand-700 transition hover:border-brand-300"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> 恢复
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPurgeTarget(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-red-600 transition hover:border-red-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> 彻底删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {purgeTarget ? (
        <PurgeDialog
          row={purgeTarget}
          onClose={() => setPurgeTarget(null)}
          onConfirm={confirmPurge}
          busy={busyId === purgeTarget.id}
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

function PurgeDialog({
  row,
  onClose,
  onConfirm,
  busy,
}: {
  row: Row
  onClose: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const [text, setText] = useState('')
  const need = row.label || row.key
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">彻底删除</h3>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-500">
            此操作将<b className="text-red-600">永久删除</b>该记录，且不可恢复。请输入对象名称确认：
          </p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-ink">
            {row.label || '—'}（{row.key}）
          </p>
          <input
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`输入「${need}」确认`}
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={text !== need || busy}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              永久删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
