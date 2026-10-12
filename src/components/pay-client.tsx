'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, CreditCard, Loader2, QrCode, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

type Channels = {
  wechat: boolean
  alipay: boolean
  onlineWechat: boolean
  onlineAlipay: boolean
  wechatQrcode: string
  alipayQrcode: string
  offlineTip: string
  contactName: string
  contactPhone: string
}

type Order = {
  orderNo: string
  packageName: string
  period: string
  amount: number
  status: string
  payMethod: string | null
  createdAt: string
  name: string
  phone: string
  company: string | null
  payment: Channels
}

type Method = 'WECHAT' | 'ALIPAY'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** 检测当前设备环境 */
function detectDevice(): 'pc' | 'mobile' | 'wechat' | 'alipay' {
  if (typeof window === 'undefined') return 'pc'
  const ua = window.navigator.userAgent.toLowerCase()
  if (ua.includes('micromessenger')) return 'wechat'
  if (ua.includes('alipayclient')) return 'alipay'
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) return 'mobile'
  return 'pc'
}

export function PayClient({ orderNo, tail }: { orderNo: string; tail: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [method, setMethod] = useState<Method>('WECHAT')
  const [verifyTail, setVerifyTail] = useState(tail)
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState('')
  // 微信 Native 二维码内容
  const [qrcode, setQrcode] = useState('')
  const device = detectDevice()

  const load = () => {
    fetch(`/api/orders/${orderNo}?tail=${encodeURIComponent(tail)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.code === 0 && json.data) {
          setOrder(json.data)
          const p = json.data.payment as Channels
          setMethod(p.wechat ? 'WECHAT' : p.alipay ? 'ALIPAY' : 'WECHAT')
        } else {
          setError(json.message || '未查询到订单')
        }
      })
      .catch(() => setError('查询失败，请稍后重试'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!tail) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNo, tail])

  // 已支付/支付中轮询状态
  useEffect(() => {
    if (!tail || order?.status !== 'PENDING') return
    const timer = setInterval(() => {
      fetch(`/api/orders/${orderNo}?tail=${encodeURIComponent(tail)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.code === 0 && json.data?.status === 'PAID') setOrder(json.data)
        })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(timer)
  }, [orderNo, tail, order?.status])

  /** 发起支付（走统一可插拔接口） */
  async function pay() {
    if (!order) return
    const p = order.payment
    const channel = method === 'WECHAT' ? 'wxpay' : 'alipay'
    const online = method === 'WECHAT' ? p.onlineWechat : p.onlineAlipay

    // 无线上渠道 → 展示收款码（已在下方渲染，这里不处理）
    if (!online) return

    setSubmitting(true)
    setPayError('')
    setQrcode('')
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: order.orderNo, channel, scene: 'web', device }),
      })
      const json = await res.json()
      if (json.code !== 0 || !json.data) {
        setPayError(json.message || '支付发起失败')
        return
      }
      const d = json.data
      if (d.payType === 'jump' && d.payInfo) {
        // H5：跳转到微信/支付宝收银台
        window.location.href = d.payInfo
      } else if (d.payType === 'qrcode' && d.payInfo) {
        // PC：展示扫码二维码
        setQrcode(d.payInfo)
      } else {
        setPayError('支付发起失败')
      }
    } catch {
      setPayError('网络异常，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (!tail) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-white p-8">
        <h1 className="text-lg font-semibold text-ink">查询订单</h1>
        <p className="mt-1.5 text-sm text-slate-500">请输入下单时的手机号后四位，查看订单信息。</p>
        <div className="mt-4 flex gap-2">
          <input
            className="field max-w-[180px]"
            maxLength={4}
            value={verifyTail}
            onChange={(e) => setVerifyTail(e.target.value.replace(/\D/g, ''))}
            placeholder="后四位"
          />
          <button
            className="btn-primary"
            onClick={() => {
              if (verifyTail.length === 4) window.location.search = `?tail=${verifyTail}`
            }}
          >
            查询
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-white p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> 正在查询订单…
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-white p-8">
        <h1 className="text-lg font-semibold text-ink">未查询到订单</h1>
        <p className="mt-1.5 text-sm text-slate-500">{error || '请检查订单号与手机号后四位是否正确。'}</p>
      </div>
    )
  }

  const p = order.payment
  const paid = order.status === 'PAID'

  return (
    <div className="mt-6 space-y-4">
      {/* 订单信息 */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400">订单号 {order.orderNo}</div>
            <h1 className="mt-1 text-xl font-semibold text-ink">
              {order.packageName}
              <span className="ml-2 text-sm font-normal text-slate-400">/ {order.period}</span>
            </h1>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-xs', paid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
            {STATUS_LABEL[order.status] || order.status}
          </span>
        </div>

        <div className="mt-5 flex items-end gap-1.5 border-t border-line pt-5">
          <span className="text-3xl font-semibold tracking-tight text-ink">¥{yuan(order.amount)}</span>
        </div>
      </div>

      {/* 支付方式 */}
      {paid ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-800">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" /> 该订单已完成支付
          </div>
          <p className="mt-1.5 text-green-700">我们的顾问会与你对接服务开通事宜，请保持电话畅通。</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">选择支付方式</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MethodButton active={method === 'WECHAT'} disabled={!p.wechat} onClick={() => setMethod('WECHAT')} label="微信支付" icon={<CreditCard className="h-5 w-5" />} />
            <MethodButton active={method === 'ALIPAY'} disabled={!p.alipay} onClick={() => setMethod('ALIPAY')} label="支付宝" icon={<Smartphone className="h-5 w-5" />} />
          </div>

          {payError ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{payError}</p> : null}

          <div className="mt-5 rounded-xl bg-mist p-5">
            {method === 'WECHAT' ? (
              p.wechat ? (
                p.onlineWechat ? (
                  qrcode ? (
                    <div className="text-center">
                      <QrCanvas text={qrcode} />
                      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-600">
                        <QrCode className="h-4 w-4 text-brand-600" /> 请使用微信扫一扫支付 ¥{yuan(order.amount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">支付成功后本页会自动刷新状态</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-slate-600">
                        {device === 'pc' ? '点击下方按钮生成微信支付二维码' : '点击下方按钮唤起微信支付'}
                      </p>
                      <button type="button" onClick={pay} disabled={submitting} className="btn-primary mt-3 min-w-[200px]">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {device === 'pc' ? '生成支付二维码' : '立即支付'}
                      </button>
                    </div>
                  )
                ) : (
                  <QrBlock src={p.wechatQrcode} text="请使用微信扫描收款码完成支付" />
                )
              ) : (
                <PendingTip text="微信支付暂未开通，请联系顾问协助付款。" />
              )
            ) : null}

            {method === 'ALIPAY' ? (
              p.alipay ? (
                p.onlineAlipay ? (
                  <div className="text-center">
                    <p className="text-sm text-slate-600">点击下方按钮前往支付宝支付</p>
                    <button type="button" onClick={pay} disabled={submitting} className="btn-primary mt-3 min-w-[200px]">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      前往支付宝支付 ¥{yuan(order.amount)}
                    </button>
                  </div>
                ) : (
                  <QrBlock src={p.alipayQrcode} text="请使用支付宝扫描收款码完成支付" />
                )
              ) : (
                <PendingTip text="支付宝暂未开通，请联系顾问协助付款。" />
              )
            ) : null}

            {(p.contactName || p.contactPhone) && !(method === 'WECHAT' ? p.wechat : p.alipay) ? (
              <p className="mt-3 text-center text-xs text-slate-400">
                如遇问题请联系：{p.contactName || '客服'} {p.contactPhone ? `· ${p.contactPhone}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

/** 用 code_url 生成二维码（无依赖：在线二维码服务） */
function QrCanvas({ text }: { text: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}`
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="支付二维码" className="mx-auto h-56 w-56 rounded-lg border border-line bg-white object-contain" />
  )
}

function MethodButton({
  active,
  disabled,
  onClick,
  label,
  icon,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border p-4 text-left transition',
        disabled
          ? 'cursor-not-allowed border-line bg-slate-50 text-slate-300'
          : active
            ? 'border-brand-600 bg-brand-50 text-brand-700'
            : 'border-line bg-white text-slate-600 hover:border-brand-200',
      )}
    >
      <span className={cn(active ? 'text-brand-600' : 'text-slate-400')}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function QrBlock({ src, text }: { src: string; text: string }) {
  return (
    <div className="text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="收款码" className="mx-auto h-52 w-52 rounded-lg border border-line bg-white object-contain" />
      <p className="mt-3 text-sm text-slate-600">{text}</p>
      <p className="mt-1 text-xs text-slate-400">付款完成后请保留凭证，顾问核对后会为你开通服务。</p>
    </div>
  )
}

function PendingTip({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed text-slate-600">{text}</p>
}
