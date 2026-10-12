'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export function LeadCreateForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    company: '',
    city: '',
    industry: '',
    message: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('请填写客户姓名')
    if (!/^[0-9+\-\s()]{6,20}$/.test(form.phone.trim())) return setError('请填写正确的手机号')

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          requirements: [],
          source: '后台录入',
          sourcePage: '/admin',
        }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      router.push('/admin/leads')
      router.refresh()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">姓名 *</label>
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">手机号 *</label>
          <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">公司</label>
          <input className="field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </div>
        <div>
          <label className="label">城市</label>
          <input className="field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <label className="label">行业</label>
          <input className="field" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">需求描述</label>
        <textarea
          className="field min-h-[100px]"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
        </button>
        <button type="button" className="btn-outline" onClick={() => router.back()}>
          取消
        </button>
      </div>
    </form>
  )
}
