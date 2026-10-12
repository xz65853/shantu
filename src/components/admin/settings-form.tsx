'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ImageField } from './image-field'

type FieldType = 'text' | 'textarea' | 'image' | 'switch' | 'number' | 'color'

const FIELDS: { group: string; items: { key: string; label: string; type?: FieldType; hint?: string; step?: string }[] }[] = [
  {
    group: '基础信息',
    items: [
      { key: 'site_name', label: '公司名称' },
      { key: 'site_slogan', label: '网站副标题 / 定位' },
      { key: 'logo_text', label: 'Logo 文字' },
      { key: 'site_logo', label: '站点 Logo 图片', type: 'image' },
      { key: 'footer_note', label: '底部一句话', type: 'textarea' },
    ],
  },
  {
    group: '联系方式',
    items: [
      { key: 'contact_phone', label: '联系电话' },
      { key: 'contact_email', label: '邮箱' },
      { key: 'contact_address', label: '公司地址' },
      { key: 'wechat_qrcode', label: '微信二维码', type: 'image' },
      { key: 'icp', label: 'ICP 备案号' },
      { key: 'douyin', label: '抖音' },
      { key: 'xiaohongshu', label: '小红书' },
      { key: 'notify_webhook', label: '线索推送 Webhook（企业微信机器人，选填）' },
      { key: 'login_alert_webhook', label: '登录异常告警 Webhook（企业微信机器人，选填）' },
    ],
  },
  {
    group: 'SEO 设置',
    items: [
      { key: 'seo_title', label: '网站 Title' },
      { key: 'seo_description', label: '网站 Description', type: 'textarea' },
      { key: 'seo_keywords', label: '网站 Keywords' },
    ],
  },
  {
    group: '关于我们',
    items: [{ key: 'about_intro', label: '公司简介', type: 'textarea' }],
  },
  {
    group: '小程序 AI 功能',
    items: [
      { key: 'mini_ai_enabled', label: '开启 AI 运营顾问', type: 'switch', hint: '关闭后小程序AI入口不可用，过审后再打开' },
    ],
  },
  {
    group: 'AI 限流设置（每分钟次数）',
    items: [
      { key: 'ai_limit_default', label: '默认限制' },
      { key: 'ai_limit_article_write', label: '写文章' },
      { key: 'ai_limit_case_write', label: '写案例' },
      { key: 'ai_limit_daily_fill', label: '日报补全' },
      { key: 'ai_limit_title_suggest', label: '改标题' },
      { key: 'ai_limit_dashboard_brief', label: '工作台播报' },
    ],
  },
  {
    group: '水印设置（小程序溯源）',
    items: [
      { key: 'watermark_enable', label: '水印总开关', type: 'switch' },
      { key: 'watermark_template', label: '文案模板', hint: '占位符：{name}=姓名 {phone4}=手机后4位 {date}=日期' },
      { key: 'watermark_opacity', label: '不透明度（0~1，默认 0.2）', type: 'number', step: '0.05' },
      { key: 'watermark_color', label: '颜色', type: 'color' },
      { key: 'watermark_font_size', label: '字号（px，默认 12）', type: 'number' },
      { key: 'watermark_gap_x', label: '横向间距（px，默认 300）', type: 'number' },
      { key: 'watermark_gap_y', label: '纵向间距（px，默认 250）', type: 'number' },
      { key: 'watermark_rotate', label: '旋转角度（度，默认 -30）', type: 'number' },
    ],
  },
  {
    group: '网站维护模式',
    items: [
      { key: 'maintenance_enable', label: '开启维护模式', type: 'switch', hint: '开启后前台官网显示维护页（返回 503），小程序、后台、接口均不受影响' },
      { key: 'maintenance_reason', label: '维护原因', type: 'textarea', hint: '显示在维护页的说明文字，可换行' },
      { key: 'maintenance_resume_at', label: '预计恢复时间（选填）', hint: '例如：今晚 24:00 前恢复' },
    ],
  },
]

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  // 从 ai_rate_limit JSON 展开到表单字段
  let expandedInitial = { ...initial };
  try {
    const aiCfg = JSON.parse(initial.ai_rate_limit || '{}');
    expandedInitial.ai_limit_default = String(aiCfg.default || '');
    expandedInitial.ai_limit_article_write = String(aiCfg.article_write || '');
    expandedInitial.ai_limit_case_write = String(aiCfg.case_write || '');
    expandedInitial.ai_limit_daily_fill = String(aiCfg.daily_fill || '');
    expandedInitial.ai_limit_title_suggest = String(aiCfg.title_suggest || '');
    expandedInitial.ai_limit_dashboard_brief = String(aiCfg.dashboard_brief || '');
  } catch {}
  const [form, setForm] = useState<Record<string, string>>(expandedInitial)
  // 解析AI限流配置（存在 ai_rate_limit JSON 字段）
  const aiLimitDefault = () => {
    try { return JSON.parse(initial.ai_rate_limit || '{}') } catch { return {} }
  }
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      // 序列化AI限流配置
      const aiCfg: Record<string, number> = {};
      if (form.ai_limit_default) aiCfg.default = Number(form.ai_limit_default);
      if (form.ai_limit_article_write) aiCfg.article_write = Number(form.ai_limit_article_write);
      if (form.ai_limit_case_write) aiCfg.case_write = Number(form.ai_limit_case_write);
      if (form.ai_limit_daily_fill) aiCfg.daily_fill = Number(form.ai_limit_daily_fill);
      if (form.ai_limit_title_suggest) aiCfg.title_suggest = Number(form.ai_limit_title_suggest);
      if (form.ai_limit_dashboard_brief) aiCfg.dashboard_brief = Number(form.ai_limit_dashboard_brief);
      const payload = { ...form, ai_rate_limit: JSON.stringify(aiCfg) };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setMessage(json.message || '保存失败')
        return
      }
      setMessage('保存成功，前台已更新')
      window.location.reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {FIELDS.map((section) => (
        <div key={section.group} className="rounded-xl border border-line bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink">{section.group}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.items.map((item) => {
              if (item.type === 'image') {
                return (
                  <div key={item.key} className="sm:col-span-2">
                    <ImageField
                      label={item.label}
                      value={form[item.key] || ''}
                      onChange={(v) => setForm({ ...form, [item.key]: v })}
                      folder="settings"
                    />
                  </div>
                )
              }
              if (item.type === 'switch') {
                const checked = form[item.key] === '1' || form[item.key] === 'true'
                return (
                  <div key={item.key} className="flex items-center justify-between rounded-lg border border-line px-4 py-3">
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      onClick={() => setForm({ ...form, [item.key]: checked ? '0' : '1' })}
                      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
                      />
                    </button>
                  </div>
                )
              }
              if (item.type === 'color') {
                return (
                  <div key={item.key}>
                    <label className="label">{item.label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border border-line bg-white p-0.5"
                        value={/^#[0-9a-fA-F]{6}$/.test(form[item.key] || '') ? form[item.key] : '#c0c0c0'}
                        onChange={(e) => setForm({ ...form, [item.key]: e.target.value })}
                      />
                      <input
                        className="field"
                        value={form[item.key] || ''}
                        onChange={(e) => setForm({ ...form, [item.key]: e.target.value })}
                      />
                    </div>
                  </div>
                )
              }
              return (
                <div key={item.key} className={item.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="label">{item.label}</label>
                  {item.type === 'textarea' ? (
                    <textarea
                      className="field min-h-[80px]"
                      value={form[item.key] || ''}
                      onChange={(e) => setForm({ ...form, [item.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      className="field"
                      type={item.type === 'number' ? 'number' : 'text'}
                      step={item.type === 'number' ? item.step : undefined}
                      value={form[item.key] || ''}
                      onChange={(e) => setForm({ ...form, [item.key]: e.target.value })}
                    />
                  )}
                  {item.hint ? <p className="mt-1 text-xs text-slate-400">{item.hint}</p> : null}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存设置
      </button>
    </form>
  )
}
