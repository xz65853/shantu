'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

type Coupon = {
  id: number
  code: string
  name: string
  discountType: string
  value: number
  minAmount: number
  totalCount: number
  usedCount: number
  perUserLimit: number
  status: string
  remark?: string | null
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function CouponsManager({ initial }: { initial: Coupon[] }) {
  const [list, setList] = useState<Coupon[]>(initial)
  const [form, setForm] = useState({
    code: '',
    name: '',
    discountType: 'FIXED',
    value: '',
    minAmount: '',
    totalCount: '',
    perUserLimit: '1',
    remark: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim() || !form.value) {
      setMessage('请填写优惠码、名称和优惠值')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const value =
        form.discountType === 'FIXED' ? Math.round(Number(form.value) * 100) : Number(form.value)
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          discountType: form.discountType,
          value,
          minAmount: Math.round(Number(form.minAmount || 0) * 100),
          totalCount: Number(form.totalCount || 0),
          perUserLimit: Number(form.perUserLimit || 1),
          remark: form.remark.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setMessage(json.message || '创建失败')
        return
      }
      setMessage('创建成功')
      const r = await fetch('/api/admin/coupons')
      const j = await r.json()
      if (j.code === 0) setList(j.data.list)
      setForm({
        code: '',
        name: '',
        discountType: 'FIXED',
        value: '',
        minAmount: '',
        totalCount: '',
        perUserLimit: '1',
        remark: '',
      })
    } catch {
      setMessage('网络异常')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">新建优惠码</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">优惠码 *</label>
            <input className="field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 SHANTU1000" maxLength={40} />
          </div>
          <div>
            <label className="label">名称 *</label>
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 立减1000" maxLength={60} />
          </div>
          <div>
            <label className="label">类型</label>
            <select className="field" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <option value="FIXED">固定减免（元）</option>
              <option value="PERCENT">折扣（%）</option>
            </select>
          </div>
          <div>
            <label className="label">优惠值 *</label>
            <input className="field" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.discountType === 'FIXED' ? '减免金额（元）' : '如 9 表示 9 折'} />
          </div>
          <div>
            <label className="label">最低消费（元）</label>
            <input className="field" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} placeholder="0 不限" />
          </div>
          <div>
            <label className="label">发放总量</label>
            <input className="field" value={form.totalCount} onChange={(e) => setForm({ ...form, totalCount: e.target.value })} placeholder="0 不限" />
          </div>
          <div>
            <label className="label">每人限用</label>
            <input className="field" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">备注</label>
            <input className="field" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} maxLength={200} />
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-brand-700">{message}</p> : null}
        <button type="submit" className="btn-primary mt-4" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 创建
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">优惠码列表</h2>
        </div>
        {list.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">暂无优惠码</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-slate-400">
                  <th className="px-6 py-3">优惠码</th>
                  <th className="px-6 py-3">名称</th>
                  <th className="px-6 py-3">优惠</th>
                  <th className="px-6 py-3">门槛</th>
                  <th className="px-6 py-3">已用/总量</th>
                  <th className="px-6 py-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-3 font-medium text-ink">{c.code}</td>
                    <td className="px-6 py-3">{c.name}</td>
                    <td className="px-6 py-3">{c.discountType === 'FIXED' ? `-¥${yuan(c.value)}` : `-${c.value}%`}</td>
                    <td className="px-6 py-3">{c.minAmount > 0 ? `满¥${yuan(c.minAmount)}` : '不限'}</td>
                    <td className="px-6 py-3">
                      {c.usedCount}/{c.totalCount || '∞'}
                    </td>
                    <td className="px-6 py-3">
                      {c.status === 'ACTIVE' ? (
                        <span className="text-green-600">启用</span>
                      ) : (
                        <span className="text-slate-400">停用</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
