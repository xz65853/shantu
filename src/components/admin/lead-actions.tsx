'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { LEAD_STATUS_LABEL } from './lead-status'
import { formatDate } from '@/lib/utils'

export type AdminOption = { id: number; name: string }

export function LeadStatusForm({
  leadId,
  status,
  assignedTo,
  admins,
}: {
  leadId: number
  status: string
  assignedTo: number | null
  admins: AdminOption[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(status)
  const [owner, setOwner] = useState<string>(assignedTo ? String(assignedTo) : '')

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value, assignedTo: owner ? Number(owner) : null }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">客户状态</label>
        <select className="field" value={value} onChange={(e) => setValue(e.target.value)}>
          {Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">负责人</label>
        <select className="field" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">未分配</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={save} className="btn-primary w-full" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
      </button>
    </div>
  )
}

export type FollowupItem = {
  id: number
  content: string
  author: string | null
  nextFollowupAt: string | null
  createdAt: string
}

export function FollowupPanel({
  leadId,
  items,
}: {
  leadId: number
  items: FollowupItem[]
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [nextAt, setNextAt] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), nextFollowupAt: nextAt || null }),
      })
      const json = await res.json()
      if (json.code === 0) {
        setContent('')
        setNextAt('')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">跟进记录</h2>
      </div>

      <div className="divide-y divide-line">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="px-5 py-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{item.author || '系统'}</span>
                <span>{formatDate(item.createdAt, true)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {item.content}
              </p>
              {item.nextFollowupAt ? (
                <p className="mt-2 text-xs text-brand-600">
                  下次跟进：{formatDate(item.nextFollowupAt)}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="px-5 py-10 text-center text-sm text-slate-400">还没有跟进记录</p>
        )}
      </div>

      <div className="border-t border-line p-5">
        <label className="label">添加跟进记录</label>
        <textarea
          className="field min-h-[88px] resize-y"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="例如：电话沟通，客户目前有一个抖音账号，希望做代运营。"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="label">下次跟进时间</label>
            <input
              type="date"
              className="field"
              value={nextAt}
              onChange={(e) => setNextAt(e.target.value)}
            />
          </div>
          <button type="button" onClick={add} className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            添加记录
          </button>
        </div>
      </div>
    </div>
  )
}
