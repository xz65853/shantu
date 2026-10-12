'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { ImageField } from './image-field'
import { WECHAT_GROUPS, MASK_PREFIX } from '@/lib/wechat-fields'
import { cn } from '@/lib/utils'

export function WechatSettingsForm({
  initial,
  configured,
}: {
  initial: Record<string, string>
  configured: Record<string, boolean>
}) {
  const [tab, setTab] = useState(0)
  const [form, setForm] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function setValue(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/admin/wechat-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      setMessage('保存成功')
      // 重新拉取，让敏感字段回到掩码状态
      const fresh = await fetch('/api/admin/wechat-settings').then((r) => r.json())
      if (fresh?.data?.settings) {
        setForm(fresh.data.settings)
        window.location.reload()
      }
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  const group = WECHAT_GROUPS[tab]

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Tab */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {WECHAT_GROUPS.map((g, i) => (
          <button
            key={g.group}
            type="button"
            onClick={() => setTab(i)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm transition',
              tab === i
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-brand-50 hover:text-brand-700',
            )}
          >
            {g.group}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold text-ink">{group.group}</h2>
        {group.desc ? <p className="mt-1 text-xs text-slate-500">{group.desc}</p> : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {group.items.map((item) => {
            const value = form[item.key] ?? ''

            if (item.type === 'switch') {
              const on = value === '1'
              return (
                <div key={item.key} className="sm:col-span-2 flex items-start justify-between gap-4 rounded-lg border border-line bg-mist px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{item.label}</div>
                    {item.hint ? <div className="mt-0.5 text-xs text-slate-500">{item.hint}</div> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue(item.key, on ? '0' : '1')}
                    aria-pressed={on}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition',
                      on ? 'bg-brand-600' : 'bg-slate-300',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
                        on ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              )
            }

            if (item.type === 'image') {
              return (
                <div key={item.key} className="sm:col-span-2">
                  <ImageField
                    label={item.label}
                    value={value}
                    onChange={(v) => setValue(item.key, v)}
                    folder="wechat"
                  />
                </div>
              )
            }

            const isSecret = Boolean(item.secret)
            const secretSet = isSecret && (value.startsWith(MASK_PREFIX) || configured[item.key])

            return (
              <div key={item.key} className={item.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className="label flex items-center gap-1.5">
                  {item.label}
                  {isSecret ? <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> : null}
                </label>

                {item.type === 'select' ? (
                  <select
                    className="field"
                    value={value}
                    onChange={(e) => setValue(item.key, e.target.value)}
                  >
                    {(item.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : item.type === 'textarea' ? (
                  <textarea
                    className="field min-h-[96px] font-mono text-xs"
                    value={value}
                    placeholder={item.placeholder}
                    onChange={(e) => setValue(item.key, e.target.value)}
                  />
                ) : (
                  <input
                    className={cn('field', isSecret && 'font-mono')}
                    value={value}
                    placeholder={item.placeholder}
                    onChange={(e) => setValue(item.key, e.target.value)}
                  />
                )}

                {isSecret ? (
                  <p className="mt-1 text-xs text-brand-700">
                    {secretSet
                      ? '已配置并加密存储，明文不再显示；如需更换请输入新值覆盖。'
                      : '尚未配置；输入后加密保存，保存成功后不再回显明文。'}
                  </p>
                ) : item.hint ? (
                  <p className="mt-1 text-xs text-slate-400">{item.hint}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存设置
      </button>
    </form>
  )
}
