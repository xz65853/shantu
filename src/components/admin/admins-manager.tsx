'use client'

import { useState } from 'react'
import { Loader2, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export type AdminRow = {
  id: number
  username: string
  displayName: string
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'SALES' | 'FINANCE' | 'READONLY'
  isActive: boolean
  phone: string
  remark: string
  openId: string
  lastLoginAt: string | null
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  OPERATOR: '运营人员',
  SALES: '销售人员',
  FINANCE: '财务人员',
  READONLY: '只读',
}

const EMPTY = {
  id: 0,
  username: '',
  displayName: '',
  role: 'OPERATOR' as AdminRow['role'],
  password: '',
  isActive: true,
  phone: '',
  remark: '',
  openId: '',
}

export function AdminsManager({ rows }: { rows: AdminRow[] }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [bindCode, setBindCode] = useState<{ code: string; name: string } | null>(null)
  const [bindingId, setBindingId] = useState(0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.username.trim().length < 3) return setError('账号至少 3 个字符')
    if (!form.id && form.password.length < 6) return setError('初始密码至少 6 位')

    setSaving(true)
    setError('')
    try {
      const isEdit = form.id > 0
      const payload: Record<string, unknown> = {
        username: form.username,
        displayName: form.displayName,
        role: form.role,
        isActive: form.isActive,
        phone: form.phone,
        remark: form.remark,
      }
      if (form.password) payload.password = form.password

      const res = await fetch(isEdit ? `/api/admin/admins/${form.id}` : '/api/admin/admins', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      setEditing(false)
      setForm({ ...EMPTY })
      window.location.reload()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('确定删除该管理员？')) return
    await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  /** 生成 6 位绑定码（2 分钟有效），弹窗展示 */
  async function genBindCode(row: AdminRow) {
    setBindingId(row.id)
    try {
      const res = await fetch('/api/admin/admins/bind-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: row.id }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        alert(json.message || '生成失败')
        return
      }
      setBindCode({ code: json.data.code, name: json.data.adminName })
    } catch {
      alert('网络异常，请重试')
    } finally {
      setBindingId(0)
    }
  }

  /** 解绑微信 */
  async function unbind(id: number) {
    if (!confirm('确定解绑该管理员的微信？解绑后其小程序端入口立即消失。')) return
    await fetch(`/api/admin/admins/${id}/unbind`, { method: 'POST' })
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setForm({ ...EMPTY })
            setEditing(true)
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> 新增管理员
        </button>
      </div>

      {editing ? (
        <form onSubmit={submit} className="rounded-xl border border-brand-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">
            {form.id ? '编辑管理员' : '新增管理员'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">账号 *</label>
              <input
                className="field"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="登录账号"
              />
            </div>
            <div>
              <label className="label">姓名 *</label>
              <input
                className="field"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">手机号</label>
              <input
                className="field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="选填，用于联系"
              />
            </div>
            <div>
              <label className="label">角色</label>
              <select
                className="field"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AdminRow['role'] })}
              >
                <option value="SUPER_ADMIN">超级管理员</option>
                <option value="OPERATOR">运营人员</option>
                <option value="SALES">销售人员</option>
                <option value="FINANCE">财务人员</option>
                <option value="READONLY">只读</option>
              </select>
            </div>
            <div>
              <label className="label">{form.id ? '重置密码（留空不修改）' : '初始密码 *'}</label>
              <input
                type="password"
                className="field"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="label">备注</label>
              <input
                className="field"
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                placeholder="选填"
              />
            </div>
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="mt-5 flex gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
            </button>
            <button type="button" className="btn-outline" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">账号 / 姓名</th>
                <th className="px-5 py-3 font-medium">手机号</th>
                <th className="px-5 py-3 font-medium">角色</th>
                <th className="px-5 py-3 font-medium">微信绑定</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-mist/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{row.displayName}</div>
                    <div className="text-xs text-slate-400">{row.username}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{row.phone || '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{ROLE_LABEL[row.role] || row.role}</td>
                  <td className="px-5 py-3">
                    {row.openId ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        已绑定
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        未绑定
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${
                        row.isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.isActive ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {row.openId ? (
                        <button
                          type="button"
                          onClick={() => unbind(row.id)}
                          className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:border-red-200 hover:text-red-600"
                        >
                          解绑
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => genBindCode(row)}
                          disabled={bindingId === row.id}
                          className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
                        >
                          {bindingId === row.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Link2 className="h-3 w-3" />
                          )}
                          生成绑定码
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...row, password: '' })
                          setEditing(true)
                        }}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {bindCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <h3 className="text-base font-semibold text-ink">绑定码已生成</h3>
            <p className="mt-2 text-sm text-slate-500">
              {bindCode.name} 在小程序「我的 → 我的是员工？点这里绑定」输入以下 6 位数字
            </p>
            <div className="mt-4 text-4xl font-bold tracking-[0.4em] text-brand-600">{bindCode.code}</div>
            <p className="mt-2 text-xs text-slate-400">2 分钟内有效，过期需重新生成</p>
            <button type="button" className="btn-primary mt-5 w-full" onClick={() => setBindCode(null)}>
              我知道了
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
