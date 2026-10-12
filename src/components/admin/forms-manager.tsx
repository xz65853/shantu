'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

export type FormOptionRow = {
  id: number
  group: 'industry' | 'requirement'
  label: string
  value: string
  sort: number
  isActive: boolean
}

const GROUP_LABEL: Record<string, string> = {
  industry: '所属行业',
  requirement: '希望了解',
}

export function FormsManager({ items }: { items: FormOptionRow[] }) {
  const [group, setGroup] = useState<'industry' | 'requirement'>('industry')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group, label: label.trim(), value: label.trim(), sort: 0 }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '添加失败')
        return
      }
      setLabel('')
      window.location.reload()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('确定删除该选项？')) return
    await fetch(`/api/admin/forms/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-5"
      >
        <div className="min-w-[160px]">
          <label className="label">分组</label>
          <select
            className="field"
            value={group}
            onChange={(e) => setGroup(e.target.value as 'industry' | 'requirement')}
          >
            <option value="industry">所属行业</option>
            <option value="requirement">希望了解</option>
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label">选项名称</label>
          <input
            className="field"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="如：餐饮 / 抖音代运营"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          添加选项
        </button>
      </form>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {(['industry', 'requirement'] as const).map((g) => (
          <div key={g} className="rounded-xl border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">{GROUP_LABEL[g]}</h2>
              <p className="mt-0.5 text-xs text-slate-400">前台咨询表单会读取这里的选项</p>
            </div>
            <ul className="divide-y divide-line">
              {items.filter((i) => i.group === g).length ? (
                items
                  .filter((i) => i.group === g)
                  .map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-slate-700">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="rounded-md border border-line p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
                        aria-label="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))
              ) : (
                <li className="px-5 py-8 text-center text-sm text-slate-400">暂无选项</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
