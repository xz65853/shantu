'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'login' | 'register' | 'setpwd'

const TABS: { v: Tab; label: string }[] = [
  { v: 'login', label: '登录' },
  { v: 'register', label: '注册' },
  { v: 'setpwd', label: '设置密码' },
]

function pwdTip(v: string) {
  if (!v) return '6-20 位，建议字母 + 数字组合'
  if (v.length < 6) return '密码至少 6 位'
  return ''
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/pricing'

  const [tab, setTab] = useState<Tab>('login')
  const [account, setAccount] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function afterLogin(data: { userId?: string | null }) {
    setNotice(data.userId ? `登录成功，会员ID：${data.userId}` : '登录成功')
    router.push(redirect)
    router.refresh()
  }

  async function post(url: string, payload: Record<string, unknown>) {
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '操作失败，请稍后重试')
        // 老账号无密码：引导到设置密码
        if (json.code === 409) {
          setTab('setpwd')
          setPhone(/^1[3-9]\d{9}$/.test(account) ? account : '')
        }
        return
      }
      afterLogin(json.data || {})
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (tab === 'login') {
      if (!account.trim()) return setError('请输入手机号或会员ID')
      if (password.length < 6) return setError('请输入密码（至少 6 位）')
      return post('/api/auth/member/login', { account: account.trim(), password })
    }
    if (tab === 'register') {
      if (!/^1[3-9]\d{9}$/.test(phone)) return setError('请输入正确的 11 位手机号')
      if (password.length < 6) return setError('密码至少 6 位')
      if (password !== confirm) return setError('两次输入的密码不一致')
      return post('/api/auth/member/register', { phone, password, name: name || undefined })
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) return setError('请输入正确的 11 位手机号')
    if (password.length < 6) return setError('密码至少 6 位')
    if (password !== confirm) return setError('两次输入的密码不一致')
    return post('/api/auth/member/set-password', { phone, password })
  }

  return (
    <div className="mt-6">
      {/* Tab */}
      <div className="flex gap-1 rounded-xl bg-mist p-1">
        {TABS.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => {
              setTab(t.v)
              setError('')
              setNotice('')
            }}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition',
              tab === t.v ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {tab === 'login' ? (
          <>
            <div>
              <label className="label">登录账号 *</label>
              <input
                className="field"
                value={account}
                onChange={(e) => setAccount(e.target.value.trim())}
                placeholder="手机号 或 会员ID（如 TJ100001）"
                autoComplete="username"
              />
              <p className="mt-1 text-xs text-slate-400">注册后可在「我的」查看会员ID，手机号与会员ID 均可登录</p>
            </div>
            <div>
              <label className="label">登录密码 *</label>
              <div className="relative">
                <input
                  className="field pr-11"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入登录密码"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  aria-label="显示/隐藏密码"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label">手机号 *</label>
              <input
                className="field"
                inputMode="numeric"
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="请输入手机号"
                autoComplete="tel"
              />
              {tab === 'setpwd' ? (
                <p className="mt-1 text-xs text-slate-400">
                  早期用手机号直接登录的账号、或小程序微信登录的账号还没有密码，这里可直接设置
                </p>
              ) : null}
            </div>
            {tab === 'register' ? (
              <div>
                <label className="label">您的称呼</label>
                <input
                  className="field"
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="选填，方便顾问联系您"
                />
              </div>
            ) : null}
            <div>
              <label className="label">设置密码 *</label>
              <div className="relative">
                <input
                  className="field pr-11"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6-20 位密码"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  aria-label="显示/隐藏密码"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwdTip(password) ? <p className="mt-1 text-xs text-slate-400">{pwdTip(password)}</p> : null}
            </div>
            <div>
              <label className="label">确认密码 *</label>
              <input
                className="field"
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="请再次输入密码"
                autoComplete="new-password"
              />
            </div>
          </>
        )}

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        ) : null}
        {notice ? (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {tab === 'login' ? '登录' : tab === 'register' ? '注册并登录' : '设置密码并登录'}
        </button>
      </form>
    </div>
  )
}
