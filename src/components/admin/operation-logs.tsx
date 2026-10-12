'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Search, X } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

type Row = {
  id: number
  username: string | null
  module: string
  action: string
  targetType: string | null
  targetId: number | null
  beforeJson: string | null
  afterJson: string | null
  ip: string | null
  createdAt: string
}

const ACTION_LABEL: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  restore: '恢复',
  purge: '彻底删除',
  login: '登录',
}

function tryParse(s: string | null): Record<string, unknown> | null {
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export function OperationLogs() {
  const [list, setList] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [username, setUsername] = useState('')
  const [query, setQuery] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (query.module) params.set('module', query.module)
      if (query.action) params.set('action', query.action)
      if (query.username) params.set('username', query.username)
      const res = await fetch(`/api/admin/logs/operation?${params}`)
      const json = await res.json()
      if (json.code === 0) {
        setList(json.data.list)
        setTotal(json.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    load()
  }, [load])

  const exportHref =
    '/api/admin/logs/operation/export?module=' +
    encodeURIComponent(query.module || '') +
    '&action=' +
    encodeURIComponent(query.action || '') +
    '&username=' +
    encodeURIComponent(query.username || '')

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQuery({ module, action, username })
        }}
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input className="field w-44 pl-8" placeholder="操作人" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <select className="field w-28" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">全部模块</option>
          {['订单', '会员', '线索', '套餐', '设置', '回收站'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className="field w-32" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">全部动作</option>
          <option value="delete">删除</option>
          <option value="restore">恢复</option>
          <option value="purge">彻底删除</option>
          <option value="update">修改</option>
        </select>
        <button type="submit" className="btn-primary">筛选</button>
        <a
          href={exportHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
        >
          <Download className="h-4 w-4" /> 导出 CSV
        </a>
      </form>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {loading ? (
          <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">暂无操作日志</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">操作人</th>
                <th className="px-4 py-3 font-medium">模块</th>
                <th className="px-4 py-3 font-medium">动作</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">对比</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className="transition hover:bg-mist/60">
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(r.createdAt, true)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{r.username || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.module}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', r.action === 'delete' || r.action === 'purge' ? 'bg-red-50 text-red-600' : r.action === 'restore' ? 'bg-green-50 text-green-700' : 'bg-brand-50 text-brand-700')}>
                      {ACTION_LABEL[r.action] || r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.ip || '—'}</td>
                  <td className="px-4 py-3">
                    {(r.beforeJson || r.afterJson) ? (
                      <button type="button" onClick={() => setDetail(r)} className="text-xs text-brand-700 hover:underline">
                        查看对比
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-slate-400">共 {total} 条</span>
        <button className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>上一页</button>
        <button className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" disabled={page * 50 >= total} onClick={() => setPage((v) => v + 1)}>下一页</button>
      </div>

      {detail ? <DiffDialog row={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}

function DiffDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const before = tryParse(row.beforeJson)
  const after = tryParse(row.afterJson)
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">操作对比</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {row.module} · {ACTION_LABEL[row.action] || row.action} · {row.username || '—'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">字段</th>
                <th className="px-4 py-2.5 font-medium">改前</th>
                <th className="px-4 py-2.5 font-medium">改后</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">无快照数据</td></tr>
              ) : (
                keys.map((k) => {
                  const b = before?.[k]
                  const a = after?.[k]
                  const changed = JSON.stringify(b) !== JSON.stringify(a)
                  return (
                    <tr key={k} className={changed ? 'bg-amber-50/50' : ''}>
                      <td className="px-4 py-2 font-medium text-ink">{k}</td>
                      <td className="px-4 py-2 text-slate-600">{b === undefined ? '—' : String(b)}</td>
                      <td className={cn('px-4 py-2', changed ? 'font-medium text-amber-700' : 'text-slate-600')}>
                        {a === undefined ? '—' : String(a)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
