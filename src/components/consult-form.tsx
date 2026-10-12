'use client'

import { useState } from 'react'
import { Check, Loader2, PhoneCall } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Option = { id: number; label: string; value: string }

export function ConsultForm({
  industries = [],
  compact = false,
}: {
  industries?: Option[]
  compact?: boolean
}) {
  const [phone, setPhone] = useState('')
  const [industry, setIndustry] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return
    const p = phone.trim()
    if (!/^1[3-9]\d{9}$/.test(p)) {
      setErrorMsg('请填写正确的 11 位手机号')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: p,
          industry,
          source: '官网',
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setErrorMsg(json.message || '提交失败，请稍后再试')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setErrorMsg('网络异常，请稍后再试')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className={cn('card p-8 text-center', compact && 'p-6')}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-ink">提交成功</h3>
        <p className="mt-2 text-sm text-slate-500">
          顾问会在 <span className="font-medium text-brand-700">5 分钟内</span>电话联系你，
          进一步了解你的公司与具体需求。
        </p>
        <button
          type="button"
          className="btn-outline mt-6"
          onClick={() => {
            setPhone('')
            setIndustry('')
            setStatus('idle')
            setErrorMsg('')
          }}
        >
          再提交一份需求
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={cn('card p-6 sm:p-8', compact && 'p-5 sm:p-6')}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="cf-phone">
            手机号 <span className="text-red-500">*</span>
          </label>
          <input
            id="cf-phone"
            className="field"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="用于顾问电话联系"
            inputMode="numeric"
            maxLength={11}
          />
        </div>

        <div>
          <span className="label">所属行业</span>
          <div className="flex flex-wrap gap-2">
            {industries.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndustry(industry === item.value ? '' : item.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition',
                  industry === item.value
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-line text-slate-600 hover:border-brand-300',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>
      ) : null}

      <button type="submit" className="btn-primary mt-5 w-full" disabled={status === 'loading'}>
        {status === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 提交中
          </>
        ) : (
          <>
            <PhoneCall className="h-4 w-4" /> 免费获取运营方案
          </>
        )}
      </button>
      <p className="mt-3 text-center text-[11px] text-slate-400">
        我们仅将信息用于业务沟通，不会对外披露。
      </p>
    </form>
  )
}
