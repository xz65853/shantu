'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Lock, User } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '登录失败')
        setLoading(false)
        return
      }
      router.replace('/admin')
      router.refresh()
    } catch {
      setError('网络异常，请重试')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-7 shadow-soft">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="username">
            账号
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="username"
              className="field pl-9"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入管理员账号"
              autoComplete="username"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="password">
            密码
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type="password"
              className="field pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      ) : null}

      <button type="submit" className="btn-primary mt-6 w-full py-2.5" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 登录中
          </>
        ) : (
          '登录'
        )}
      </button>
    </form>
  )
}
