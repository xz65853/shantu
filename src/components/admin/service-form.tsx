'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { slugify } from '@/lib/utils'

export type ServiceFormValue = {
  id?: number
  name: string
  slug: string
  enName: string
  icon: string
  summary: string
  detail: string
  process: string
  target: string
  faq: string
  cover: string
  seoTitle: string
  seoDesc: string
  sort: number
  status: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
}

export function ServiceForm({ initial }: { initial: ServiceFormValue }) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof ServiceFormValue>(key: K, value: ServiceFormValue[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('请填写服务名称')
    if (!form.summary.trim()) return setError('请填写服务简介')

    setSaving(true)
    setError('')
    try {
      const url = form.id ? `/api/admin/services/${form.id}` : '/api/admin/services'
      const res = await fetch(url, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      router.push('/admin/services')
      router.refresh()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">基础信息</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">服务名称 *</label>
            <input
              className="field"
              value={form.name}
              onChange={(e) => {
                set('name', e.target.value)
                if (!form.id && !form.slug) set('slug', slugify(e.target.value))
              }}
            />
          </div>
          <div>
            <label className="label">URL 别名 *</label>
            <input className="field" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
          </div>
          <div>
            <label className="label">英文名称</label>
            <input className="field" value={form.enName} onChange={(e) => set('enName', e.target.value)} placeholder="如：OPERATION" />
          </div>
          <div>
            <label className="label">排序</label>
            <input type="number" className="field" value={form.sort} onChange={(e) => set('sort', Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4">
          <label className="label">服务简介 *</label>
          <textarea className="field min-h-[70px]" value={form.summary} onChange={(e) => set('summary', e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold text-ink">详细内容</h2>
        <p className="mb-4 text-xs text-slate-400">每行渲染为一个段落或一条列表项。</p>
        <div className="space-y-4">
          <div>
            <label className="label">服务内容</label>
            <textarea className="field min-h-[110px]" value={form.detail} onChange={(e) => set('detail', e.target.value)} />
          </div>
          <div>
            <label className="label">服务流程</label>
            <textarea className="field min-h-[110px]" value={form.process} onChange={(e) => set('process', e.target.value)} />
          </div>
          <div>
            <label className="label">适合客户</label>
            <textarea className="field min-h-[90px]" value={form.target} onChange={(e) => set('target', e.target.value)} />
          </div>
          <div>
            <label className="label">常见问题</label>
            <textarea className="field min-h-[90px]" value={form.faq} onChange={(e) => set('faq', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">SEO 与发布</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">SEO 标题</label>
            <input className="field" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
          </div>
          <div>
            <label className="label">SEO 描述</label>
            <input className="field" value={form.seoDesc} onChange={(e) => set('seoDesc', e.target.value)} />
          </div>
          <div>
            <label className="label">发布状态</label>
            <select
              className="field"
              value={form.status}
              onChange={(e) => set('status', e.target.value as ServiceFormValue['status'])}
            >
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">发布</option>
              <option value="OFFLINE">下架</option>
            </select>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存服务
        </button>
        <button type="button" className="btn-outline" onClick={() => router.push('/admin/services')}>
          返回列表
        </button>
      </div>
    </form>
  )
}
