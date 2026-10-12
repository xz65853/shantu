'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { ImageField } from './image-field'
import { formatDate } from '@/lib/utils'

export type BannerRow = {
  id: number
  title: string
  subtitle: string | null
  image: string | null
  buttonText: string | null
  buttonLink: string | null
  sort: number
  isActive: boolean
  startAt: string | null
  endAt: string | null
}

const EMPTY = {
  id: 0,
  title: '',
  subtitle: '',
  image: '',
  buttonText: '',
  buttonLink: '',
  sort: 0,
  isActive: true,
  startAt: '',
  endAt: '',
}

export function BannerManager({ rows }: { rows: BannerRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<BannerRow | null>(null)
  const [form, setForm] = useState<BannerRow>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startCreate() {
    setEditing({ ...EMPTY })
    setForm({ ...EMPTY })
    setError('')
  }

  function startEdit(row: BannerRow) {
    setEditing(row)
    setForm({ ...row })
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('请填写标题')

    setSaving(true)
    setError('')
    try {
      const isEdit = form.id > 0
      const res = await fetch(isEdit ? `/api/admin/banners/${form.id}` : '/api/admin/banners', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      setEditing(null)
      router.refresh()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('确定删除该 Banner？')) return
    await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button type="button" onClick={startCreate} className="btn-primary">
          <Plus className="h-4 w-4" /> 新增 Banner
        </button>
      </div>

      {editing ? (
        <form onSubmit={submit} className="rounded-xl border border-brand-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">
            {editing.id ? '编辑 Banner' : '新增 Banner'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">标题 *</label>
              <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">副标题</label>
              <input className="field" value={form.subtitle || ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>
            <div>
              <label className="label">按钮文字</label>
              <input className="field" value={form.buttonText || ''} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
            </div>
            <div>
              <label className="label">按钮链接</label>
              <input className="field" value={form.buttonLink || ''} onChange={(e) => setForm({ ...form, buttonLink: e.target.value })} placeholder="/contact" />
            </div>
            <div>
              <label className="label">开始时间</label>
              <input
                type="date"
                className="field"
                value={form.startAt ? form.startAt.slice(0, 10) : ''}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label">结束时间</label>
              <input
                type="date"
                className="field"
                value={form.endAt ? form.endAt.slice(0, 10) : ''}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label">排序</label>
              <input
                type="number"
                className="field"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand-600"
                />
                启用
              </label>
            </div>
          </div>

          <div className="mt-4">
            <ImageField value={form.image || ''} onChange={(v) => setForm({ ...form, image: v })} label="Banner 图片" folder="banners" />
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="mt-5 flex gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
            </button>
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>
              取消
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">标题</th>
                <th className="px-5 py-3 font-medium">按钮</th>
                <th className="px-5 py-3 font-medium">有效期</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-mist/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{row.title}</div>
                      {row.subtitle ? (
                        <div className="max-w-[280px] truncate text-xs text-slate-400">{row.subtitle}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {row.buttonText || '-'} {row.buttonLink ? `→ ${row.buttonLink}` : ''}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {row.startAt ? formatDate(row.startAt) : '不限'} ~{' '}
                      {row.endAt ? formatDate(row.endAt) : '不限'}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${
                          row.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.isActive ? '启用中' : '已停用'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-md border border-line p-1.5 text-slate-500 hover:border-brand-300 hover:text-brand-700"
                          aria-label="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
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
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-400">
                    暂无 Banner
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
