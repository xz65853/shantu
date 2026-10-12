'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ImageField } from './image-field'
import { cn } from '@/lib/utils'

export function PaymentSettingsForm({ initial }: { initial: Record<string, string> }) {
  const [form, setForm] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      setMessage('支付设置已保存')
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold text-ink">支付渠道</h2>
        <p className="mt-1 text-xs text-slate-500">
          开启后，前台支付页会显示对应支付方式。未上传收款码时，该渠道会提示「暂未开通」。
        </p>

        <div className="mt-4 space-y-3">
          <Switch
            label="微信支付（收款码）"
            hint="上传微信收款码即可在前台展示；未开通线上支付时使用"
            checked={form.pay_wechat_enable === '1'}
            onChange={(v) => set('pay_wechat_enable', v ? '1' : '0')}
          />
          <Switch
            label="微信支付 v3 线上支付"
            hint="下单后自动生成支付二维码 / 小程序唤起支付。需在「小程序设置 → 微信支付」填好商户号、APIv3 密钥与商户私钥，且站点为已备案 HTTPS 域名"
            checked={form.pay_wxpay_online_enable === '1'}
            onChange={(v) => set('pay_wxpay_online_enable', v ? '1' : '0')}
          />
          <Switch
            label="支付宝"
            hint="上传支付宝收款码即可在前台展示"
            checked={form.pay_alipay_enable === '1'}
            onChange={(v) => set('pay_alipay_enable', v ? '1' : '0')}
          />
          <Switch
            label="易支付（聚合支付）"
            hint="填写网关地址、商户ID与密钥后，前台与小程序下单可直接跳转易支付收银台，支持微信/支付宝通道"
            checked={form.pay_epay_enable === '1'}
            onChange={(v) => set('pay_epay_enable', v ? '1' : '0')}
          />
          <Switch
            label="线下对接"
            hint="关闭线上渠道时，用户仍可提交订单由顾问联系收款（建议保持开启）"
            checked={form.pay_offline_enable === '1'}
            onChange={(v) => set('pay_offline_enable', v ? '1' : '0')}
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold text-ink">易支付接口配置</h2>
        <p className="mt-1 text-xs text-slate-500">
          易支付为第三方聚合支付网关，配置后前台支付页与小程序均可使用。密钥加密存储，保存后只显示掩码。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">渠道显示名称</label>
            <input
              className="field"
              value={form.pay_epay_name || ''}
              onChange={(e) => set('pay_epay_name', e.target.value)}
              placeholder="如：易支付 / 在线支付"
            />
          </div>
          <div>
            <label className="label">网关地址（接口域名）*</label>
            <input
              className="field"
              value={form.pay_epay_url || ''}
              onChange={(e) => set('pay_epay_url', e.target.value.trim())}
              placeholder="如：http://47.111.128.91:5"
            />
            <p className="mt-1 text-xs text-slate-400">聚合支付平台接口地址（含端口），无需带 /api/pay/create 路径</p>
          </div>
          <div>
            <label className="label">商户ID（pid）*</label>
            <input
              className="field"
              value={form.pay_epay_pid || ''}
              onChange={(e) => set('pay_epay_pid', e.target.value.trim())}
              placeholder="如：1001"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">平台公钥（验签回调用）</label>
            <textarea
              className="field min-h-[120px] font-mono text-xs"
              value={form.pay_epay_public_key || ''}
              onChange={(e) => set('pay_epay_public_key', e.target.value.trim())}
              placeholder="-----BEGIN PUBLIC KEY----- 平台提供的公钥全文"
            />
            <p className="mt-1 text-xs text-slate-400">用于校验支付回调签名，非敏感可明文保存</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">商户私钥（签名用）*</label>
            <textarea
              className="field min-h-[140px] font-mono text-xs"
              value={form.pay_epay_private_key || ''}
              onChange={(e) => set('pay_epay_private_key', e.target.value.trim())}
              placeholder="-----BEGIN PRIVATE KEY----- 商户后台生成的商户私钥全文（留空不修改）"
            />
            <p className="mt-1 text-xs text-slate-400">加密存储，保存后仅显示后四位</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">同步跳转地址（可不填）</label>
            <input
              className="field"
              value={form.pay_epay_return_url || ''}
              onChange={(e) => set('pay_epay_return_url', e.target.value.trim())}
              placeholder="留空则回到订单支付页"
            />
            <p className="mt-1 text-xs text-slate-400">
              异步通知地址固定为：{typeof window !== 'undefined' ? window.location.origin : ''}
              /api/payment/yipay/notify
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold text-ink">收款码</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <ImageField
            label="微信收款码"
            value={form.pay_wechat_qrcode || ''}
            onChange={(v) => set('pay_wechat_qrcode', v)}
            folder="payment"
          />
          <ImageField
            label="支付宝收款码"
            value={form.pay_alipay_qrcode || ''}
            onChange={(v) => set('pay_alipay_qrcode', v)}
            folder="payment"
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold text-ink">线下对接说明</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">提示文案</label>
            <textarea
              className="field min-h-[80px]"
              value={form.pay_offline_tip || ''}
              onChange={(e) => set('pay_offline_tip', e.target.value)}
              placeholder="提交订单后，我们的顾问会在 1 个工作日内与您联系…"
            />
          </div>
          <div>
            <label className="label">对接人姓名</label>
            <input
              className="field"
              value={form.pay_contact_name || ''}
              onChange={(e) => set('pay_contact_name', e.target.value)}
            />
          </div>
          <div>
            <label className="label">对接人电话</label>
            <input
              className="field"
              value={form.pay_contact_phone || ''}
              onChange={(e) => set('pay_contact_phone', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">备注（仅后台可见）</label>
            <textarea
              className="field min-h-[60px]"
              value={form.pay_note || ''}
              onChange={(e) => set('pay_note', e.target.value)}
            />
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存设置
      </button>
    </form>
  )
}

function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-mist px-4 py-3">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-brand-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}
