'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'

const REASONS = ['测试数据', '重复提交', '客户要求', '无效', '其他']

type CascadeInfo = {
  member: { id: number; userId: string | null; name: string | null; phone: string | null }
  deleteCount: { orders: number; contracts: number; projects: number; realNames: number; leads: number }
  keptOrders: number
}

export function DeleteDialog({
  type,
  id,
  info,
  onClose,
  onDone,
}: {
  type: 'order' | 'member' | 'lead' | 'contract'
  id: number
  info: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cascade, setCascade] = useState<CascadeInfo | null>(null)
  const [loadingCascade, setLoadingCascade] = useState(false)

  // 会员删除时，拉取级联影响统计
  useEffect(() => {
    if (type !== 'member') return
    setLoadingCascade(true)
    fetch(`/api/admin/recycle/member-cascade-info?id=${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.code === 0) setCascade(json.data)
      })
      .catch(() => {})
      .finally(() => setLoadingCascade(false))
  }, [type, id])

  async function confirm() {
    if (!reason) return setError('请选择删除原因')
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/recycle/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, reason }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || '删除失败')
      onDone()
      onClose()
    } catch {
      setError('网络异常')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">删除确认</h3>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          将删除：<span className="font-medium text-ink">{info}</span>
        </p>

        {/* 会员级联删除提示 */}
        {type === 'member' ? (
          loadingCascade ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在统计关联数据…
            </div>
          ) : cascade ? (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <p className="font-medium">删除该会员将同时删除其名下：</p>
              <p className="mt-1">
                {cascade.deleteCount.orders} 笔订单、{cascade.deleteCount.contracts} 份合同、{cascade.deleteCount.projects} 个项目、{cascade.deleteCount.realNames} 条实名认证记录、{cascade.deleteCount.leads} 条线索
              </p>
              {cascade.keptOrders > 0 ? (
                <p className="mt-1 text-xs text-amber-600">
                  另有 {cascade.keptOrders} 笔已支付订单将保留（不随会员删除）
                </p>
              ) : null}
              <p className="mt-1 text-xs">删除后可在回收站恢复。</p>
            </div>
          ) : null
        ) : null}

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">删除原因 *</label>
            <select className="field" value={reason} onChange={(e) => { setReason(e.target.value); setError('') }}>
              <option value="">请选择</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-400">删除后数据移入回收站，可随时恢复。</p>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
              取消
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
