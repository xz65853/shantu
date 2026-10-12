'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Pkg = {
  id: number
  name: string
  period: string
  price: number
  recommended: boolean
}

type MemberInfo = { id: number; phone?: string | null; name?: string | null; nickname?: string | null }

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function PricingOrder({ packages }: { packages: Pkg[] }) {
  const router = useRouter()
  const [member, setMember] = useState<MemberInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [packageId, setPackageId] = useState<number>(
    packages.find((p) => p.recommended)?.id ?? packages[0]?.id ?? 0,
  )
  const [form, setForm] = useState({
    name: '',
    phone: '',
    company: '',
    city: '',
    industry: '',
    remark: '',
  })
  const [couponCode, setCouponCode] = useState('')
  const [couponInfo, setCouponInfo] = useState<{ discount?: number; message?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 只有登录会员才能购买：未登录自动跳转登录页
  useEffect(() => {
    fetch('/api/auth/member/me')
      .then((r) => r.json())
      .then((j) => {
        const m = j?.data
        if (!m) {
          router.replace('/login?redirect=%2Fpricing')
          return
        }
        setMember(m)
        setForm((prev) => ({
          ...prev,
          name: prev.name || m.name || m.nickname || '',
          phone: prev.phone || m.phone || '',
        }))
      })
      .catch(() => router.replace('/login?redirect=%2Fpricing'))
      .finally(() => setChecking(false))
  }, [router])

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function verifyCoupon() {
    const code = couponCode.trim()
    if (!code) return
    setCouponInfo({})
    try {
      const res = await fetch('/api/coupons/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, packageId }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setCouponInfo({ message: json.message || '优惠码不可用' })
        return
      }
      setCouponInfo({ discount: json.data.discount })
    } catch {
      setCouponInfo({ message: '网络异常，请稍后重试' })
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!packageId) {
      setError('请选择套餐')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, packageId, couponCode: couponCode.trim(), source: '官网套餐页' }),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        if (res.status === 401) {
          router.replace('/login?redirect=%2Fpricing')
          return
        }
        setError(json.message || '提交失败，请稍后重试')
        return
      }
      const tail = form.phone.replace(/\D/g, '').slice(-4)
      router.push(`/pay/${json.data.orderNo}?tail=${tail}`)
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在检查登录状态…
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      {/* 登录状态条 */}
      <div className="flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
        <p className="text-sm text-brand-800">
          已登录：<span className="font-medium">{member?.name || member?.nickname || member?.phone}</span>
          <span className="ml-2 text-brand-600/70">{member?.phone}</span>
        </p>
        <button
          type="button"
          onClick={async () => {
            await fetch('/api/auth/member/logout', { method: 'POST' })
            router.replace('/login?redirect=%2Fpricing')
          }}
          className="text-xs text-brand-600 underline-offset-2 hover:underline"
        >
          切换账号
        </button>
      </div>

      {/* 套餐选择 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {packages.map((p) => {
          const active = p.id === packageId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPackageId(p.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition',
                active
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-line bg-white hover:border-brand-200',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{p.name}</span>
                {active ? <Check className="h-4 w-4 text-brand-600" /> : null}
              </div>
              <div className="mt-2 text-xl font-semibold text-ink">¥{yuan(p.price)}</div>
              <div className="text-xs text-slate-400">/ {p.period}</div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">姓名 *</label>
          <input
            className="field"
            value={form.name}
            maxLength={30}
            onChange={(e) => set('name', e.target.value)}
            placeholder="请输入您的姓名"
          />
        </div>
        <div>
          <label className="label">手机号 *</label>
          <input
            className="field"
            value={form.phone}
            maxLength={20}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="用于订单查询与顾问联系"
          />
        </div>
        <div>
          <label className="label">公司 / 品牌名称</label>
          <input
            className="field"
            value={form.company}
            maxLength={80}
            onChange={(e) => set('company', e.target.value)}
          />
        </div>
        <div>
          <label className="label">所在城市</label>
          <input
            className="field"
            value={form.city}
            maxLength={40}
            onChange={(e) => set('city', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">行业</label>
          <input
            className="field"
            value={form.industry}
            maxLength={40}
            onChange={(e) => set('industry', e.target.value)}
            placeholder="如：餐饮 / 茶叶 / 工厂 / 装修"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">补充说明</label>
          <textarea
            className="field min-h-[80px]"
            value={form.remark}
            maxLength={1000}
            onChange={(e) => set('remark', e.target.value)}
            placeholder="目前账号情况、希望达成的效果等（选填）"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">优惠码（选填）</label>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              value={couponCode}
              maxLength={40}
              onChange={(e) => {
                setCouponCode(e.target.value)
                setCouponInfo({})
              }}
              placeholder="输入优惠码，如 SHANTU1000"
            />
            <button type="button" onClick={verifyCoupon} className="btn-outline shrink-0">
              验证
            </button>
          </div>
          {couponInfo.discount ? (
            <p className="mt-2 text-sm text-green-600">已优惠 ¥{yuan(couponInfo.discount)}</p>
          ) : couponInfo.message ? (
            <p className="mt-2 text-sm text-red-600">{couponInfo.message}</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        提交订单
      </button>
      <p className="text-xs text-slate-400">
        提交即生成订单，不会立即扣款。确认服务内容后再进行支付。
      </p>
    </form>
  )
}
