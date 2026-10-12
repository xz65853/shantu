'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

type Row = {
  id: number
  username: string
  ip: string | null
  ua: string | null
  status: string
  failReason: string | null
  createdAt: string
}

export function LoginLogs() {
  const [list, setList] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [username, setUsername] = useState('')
  const [ip, setIp] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (query.username) params.set('username', query.username)
      if (query.ip) params.set('ip', query.ip)
      if (query.status) params.set('status', query.status)
      const res = await fetch(`/api/admin/logs/login?${params}`)
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

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQuery({ username, ip, status })
        }}
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input className="field w-44 pl-8" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <input className="field w-40" placeholder="IP" value={ip} onChange={(e) => setIp(e.target.value)} />
        <select className="field w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="fail">失败</option>
        </select>
        <button type="submit" className="btn-primary">筛选</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {loading ? (
          <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">暂无登录日志</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">用户名</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">失败原因</th>
                <th className="px-4 py-3 font-medium">UA</th>
                <th className="px-4 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className="transition hover:bg-mist/60">
                  <td className="px-4 py-3 font-medium text-ink">{r.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.ip || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', r.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                      {r.status === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.failReason || '—'}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-400" title={r.ua || ''}>{r.ua || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(r.createdAt, true)}</td>
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
    </div>
  )
}
