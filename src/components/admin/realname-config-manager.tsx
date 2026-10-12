'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

type Channel = 'none' | 'wechat_face' | 'tencent' | 'aliyun'

export interface RealnameConfigData {
  channel: Channel
  required: boolean
  tencent: {
    secretId: string
    secretKey: string
    endpoint: string
    bizToken?: string
  }
  aliyun: {
    appCode: string
    accessKeyId: string
    accessKeySecret: string
    endpoint: string
    productCode: string
  }
  wechat: {
    verifyId: string
  }
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'none', label: '关闭实名认证' },
  { key: 'wechat_face', label: '微信原生人脸核身（推荐）' },
  { key: 'tencent', label: '腾讯云市场二要素（姓名+身份证号一致性）' },
  { key: 'aliyun', label: '阿里云二要素（姓名+身份证号一致性）' },
]

const emptyConfig: RealnameConfigData = {
  channel: 'none',
  required: true,
  tencent: { secretId: '', secretKey: '', endpoint: '', bizToken: '' },
  aliyun: { appCode: '', accessKeyId: '', accessKeySecret: '', endpoint: '', productCode: '' },
  wechat: { verifyId: '' },
}

export function RealnameConfigManager() {
  const [data, setData] = useState<RealnameConfigData>(emptyConfig)
  const [original, setOriginal] = useState<RealnameConfigData>(emptyConfig)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    load()
  }, [])

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/realname-config')
      const json = await res.json()
      if (json.code !== 0) return notify(json.message || '加载失败')
      const next = { ...emptyConfig, ...(json.data || {}) }
      setData(next)
      setOriginal(next)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/realname-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.code !== 0) return notify(json.message || '保存失败')
      notify('保存成功')
      setOriginal(data)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/realname-config/test', { method: 'POST' })
      const json = await res.json()
      if (json.code !== 0) {
        return notify(json.message || '连接失败')
      }
      notify('连接成功')
    } finally {
      setTesting(false)
    }
  }

  const updateField = <K extends keyof RealnameConfigData>(
    field: K,
    value: RealnameConfigData[K]
  ) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-line bg-white p-6">
        <h3 className="text-base font-semibold text-ink">认证渠道</h3>
        <p className="mt-1 text-xs text-slate-500">选择要使用的实名认证渠道，切换后小程序端立即生效。</p>
        <div className="mt-4 space-y-3">
          {CHANNELS.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 hover:border-brand-200">
              <input
                type="radio"
                name="channel"
                value={c.key}
                checked={data.channel === c.key}
                onChange={() => updateField('channel', c.key)}
                className="h-4 w-4 text-brand-600"
              />
              <span className="text-sm text-ink">{c.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            id="required"
            type="checkbox"
            checked={data.required}
            onChange={(e) => updateField('required', e.target.checked)}
            className="h-4 w-4 rounded border-line text-brand-600"
          />
          <label htmlFor="required" className="text-sm text-ink">下单/签合同前必须完成实名认证</label>
        </div>
      </div>

      {data.channel === 'wechat_face' && (
        <div className="rounded-xl border border-line bg-white p-6">
          <h3 className="text-base font-semibold text-ink">微信原生人脸核身</h3>
          <p className="mt-1 text-xs text-slate-500">
            请先在 mp.weixin.qq.com 后台申请人脸核身能力，并将小程序后台已申请的核身流水号配置到此处。
          </p>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="label">核身流水号/verifyId 配置说明</label>
              <input
                className="field"
                value={data.wechat.verifyId}
                onChange={(e) =>
                  updateField('wechat', { ...data.wechat, verifyId: e.target.value })
                }
                placeholder="用于业务标识，选填"
              />
            </div>
          </div>
        </div>
      )}

      {data.channel === 'tencent' && (
        <div className="rounded-xl border border-line bg-white p-6">
          <h3 className="text-base font-semibold text-ink">腾讯云市场二要素（身份证实名认证）</h3>
          <p className="mt-1 text-xs text-slate-500">
            腾讯云应用市场「身份证实名认证」商品，密钥在云市场控制台「已购买的服务」中查看。SecretKey 加密存储、接口不回显明文，更换密钥无需发版，保存后小程序端立即生效。
          </p>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="label">SecretId（必填）</label>
              <input
                type="password"
                className="field"
                value={data.tencent.secretId}
                onChange={(e) => updateField('tencent', { ...data.tencent, secretId: e.target.value })}
                placeholder="云市场分配的密钥 Id"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">SecretKey（必填）</label>
              <input
                type="password"
                className="field"
                value={data.tencent.secretKey}
                onChange={(e) => updateField('tencent', { ...data.tencent, secretKey: e.target.value })}
                placeholder="云市场分配的密钥 Key"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">调用地址（选填，一般无需修改）</label>
              <input
                className="field"
                value={data.tencent.endpoint}
                onChange={(e) => updateField('tencent', { ...data.tencent, endpoint: e.target.value })}
                placeholder="留空使用默认：商品 25386 北京区接口地址"
              />
              <p className="mt-1 text-xs text-slate-400">仅当换购其他同类商品时才需要修改。</p>
            </div>
          </div>
        </div>
      )}

      {data.channel === 'aliyun' && (
        <div className="rounded-xl border border-line bg-white p-6">
          <h3 className="text-base font-semibold text-ink">阿里云二要素（身份证二要素核验）</h3>
          <p className="mt-1 text-xs text-slate-500">
            阿里云市场「身份证二要素核验」商品，AppCode 可在阿里云市场控制台查看。AppCode 加密存储，保存后小程序端立即生效，换 AppCode 无需发版。
          </p>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="label">AppCode（必填）</label>
              <input
                type="password"
                className="field"
                value={data.aliyun.appCode}
                onChange={(e) => updateField('aliyun', { ...data.aliyun, appCode: e.target.value })}
                placeholder="阿里云市场 AppCode，形如 32 位字符串"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="btn-primary inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          保存配置
        </button>
        {data.channel !== 'none' && (
          <button
            type="button"
            onClick={testConnection}
            disabled={testing || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-brand-200 hover:text-brand-700"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            测试连接
          </button>
        )}
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
