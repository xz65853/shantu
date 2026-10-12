'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { AiCaseButton } from './ai-case-button'
import { ImageField } from './image-field'
import { slugify } from '@/lib/utils'

export type CaseFormValue = {
  id?: number
  title: string
  slug: string
  subtitle: string
  industry: string
  projectType: string
  clientName: string
  period: string
  cover: string
  summary: string
  background: string
  strategy: string
  execution: string
  result: string
  resultRows?: { name: string; value: string }[]
  metrics: { label: string; value: string }[]
  showMetrics: boolean
  gallery: string[]
  video: string
  seoTitle: string
  seoDesc: string
  isFeatured: boolean
  sort: number
  status: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  categoryId: number | null
}

export type CategoryOption = { id: number; name: string }

export function CaseForm({
  initial,
  categories,
}: {
  initial: CaseFormValue
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [form, setForm] = useState<CaseFormValue>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof CaseFormValue>(key: K, value: CaseFormValue[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('请填写案例标题')
    if (!form.slug.trim()) return setError('请填写 URL 别名')

    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        metrics: JSON.stringify(form.metrics.filter((m) => m.label || m.value)),
        gallery: JSON.stringify(form.gallery.filter(Boolean)),
      }
      const url = form.id ? `/api/admin/cases/${form.id}` : '/api/admin/cases'
      const res = await fetch(url, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      router.push('/admin/cases')
      router.refresh()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">基础信息</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex justify-end"><AiCaseButton onFill={(title, content) => { set('title', title); set('result', content) }} /></div>
            <label className="label">案例标题 *</label>
            <input
              className="field"
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value)
                if (!form.id && !form.slug) set('slug', slugify(e.target.value))
              }}
            />
          </div>
          <div>
            <label className="label">URL 别名 *</label>
            <input className="field" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">英文或拼音，如：anhu-ice-moraine</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">副标题</label>
            <input className="field" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
          </div>
          <div>
            <label className="label">所属行业</label>
            <input className="field" value={form.industry} onChange={(e) => set('industry', e.target.value)} placeholder="如：茶叶" />
          </div>
          <div>
            <label className="label">项目类型</label>
            <input className="field" value={form.projectType} onChange={(e) => set('projectType', e.target.value)} placeholder="如：抖音运营 · 直播" />
          </div>
          <div>
            <label className="label">客户名称</label>
            <input className="field" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} />
          </div>
          <div>
            <label className="label">项目周期</label>
            <input className="field" value={form.period} onChange={(e) => set('period', e.target.value)} placeholder="如：3 个月" />
          </div>
          <div>
            <label className="label">案例分类</label>
            <select
              className="field"
              value={form.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">排序（越小越靠前）</label>
            <input
              type="number"
              className="field"
              value={form.sort}
              onChange={(e) => set('sort', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">案例摘要</label>
          <textarea
            className="field min-h-[72px]"
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
          />
        </div>

        <div className="mt-4">
          <ImageField value={form.cover} onChange={(v) => set('cover', v)} label="案例封面" folder="cases-cover" />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold text-ink">项目内容</h2>
        <p className="mb-4 text-xs text-slate-400">每行会渲染为一个段落，可按执行步骤分行填写。</p>
        <div className="space-y-4">
          {(
            [
              ['background', '项目背景', '客户当时遇到什么问题？'],
              ['strategy', '运营方案', '我们怎么解决？'],
              ['execution', '执行内容', '账号 / 短视频 / 直播 / 投放 / 商品'],
              ['background', '项目背景', '客户当时遇到什么问题？'],
              ['strategy', '运营方案', '我们怎么解决？'],
              ['execution', '执行内容', '账号 / 短视频 / 直播 / 投放 / 商品'],
            ] as const
          ).map(([key, label, placeholder]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <textarea
                className="field min-h-[110px]"
                value={form[key] as string}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}

          {/* 项目结果：表格快捷编辑 */}
          <div>
            <label className="label">项目结果</label>
            <textarea
              className="field min-h-[110px]"
              value={form.result}
              onChange={(e) => set('result', e.target.value)}
              placeholder={'最终达成了什么，也可以用下面的表格快速生成'}
            />
            <div className="mt-2 rounded-lg bg-slate-50 p-3">
              <div className="mb-2 text-xs font-medium text-slate-600">快捷表格（填入后点插入）</div>
              {(form.resultRows || [{name: '', value: ''}]).map((row, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input
                    className="field flex-1"
                    placeholder="指标名，如：播放量"
                    value={row.name}
                    onChange={(e) => {
                      const rows = [...(form.resultRows || [{name: '', value: ''}])]
                      rows[i] = { ...rows[i], name: e.target.value }
                      set('resultRows', rows)
                    }}
                  />
                  <input
                    className="field flex-1"
                    placeholder="数值，如：12.5万"
                    value={row.value}
                    onChange={(e) => {
                      const rows = [...(form.resultRows || [{name: '', value: ''}])]
                      rows[i] = { ...rows[i], value: e.target.value }
                      set('resultRows', rows)
                    }}
                  />
                  <button type="button" className="text-red-500 text-sm" onClick={() => {
                    const rows = (form.resultRows || []).filter((_, idx) => idx !== i)
                    set('resultRows', rows.length ? rows : [{name: '', value: ''}])
                  }}>×</button>
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-blue-600"
                  onClick={() => set('resultRows', [...(form.resultRows || [{name: '', value: ''}]), {name: '', value: ''}])}
                >+ 添加一行</button>
                <button
                  type="button"
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={() => {
                    const rows = (form.resultRows || []).filter(r => r.name && r.value)
                    if (!rows.length) return
                    const tableHtml = '<table style="width:100%;border-collapse:collapse;margin:10px 0;">' +
                      rows.map(r => '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:500;">' + r.name + '</td><td style="padding:8px;border:1px solid #e5e7eb;">' + r.value + '</td></tr>').join('') +
                      '</table>'
                    set('result', (form.result || '') + tableHtml)
                  }}
                >插入表格到结果</button>
              </div>
            </div>
          </div>}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">项目数据</h2>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={form.showMetrics}
              onChange={(e) => set('showMetrics', e.target.checked)}
              className="h-4 w-4 rounded border-line text-brand-600"
            />
            在详情页展示数据
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          没有经过确认的数据请不要填写，关闭开关即可只展示项目过程。
        </p>

        <div className="mt-4 space-y-3">
          {form.metrics.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="field"
                placeholder="指标名，如：播放量"
                value={m.label}
                onChange={(e) => {
                  const next = [...form.metrics]
                  next[i] = { ...next[i], label: e.target.value }
                  set('metrics', next)
                }}
              />
              <input
                className="field"
                placeholder="数值"
                value={m.value}
                onChange={(e) => {
                  const next = [...form.metrics]
                  next[i] = { ...next[i], value: e.target.value }
                  set('metrics', next)
                }}
              />
              <button
                type="button"
                onClick={() => set('metrics', form.metrics.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded-lg border border-line px-2.5 text-slate-400 hover:border-red-200 hover:text-red-600"
                aria-label="删除指标"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('metrics', [...form.metrics, { label: '', value: '' }])}
            className="btn-outline w-full"
          >
            <Plus className="h-4 w-4" /> 添加一项数据
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">图片与视频</h2>
        <div className="space-y-3">
          {form.gallery.map((src, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <ImageField
                  value={src}
                  onChange={(v) => {
                    const next = [...form.gallery]
                    next[i] = v
                    set('gallery', next)
                  }}
                  label={i === 0 ? '项目图片' : ''}
                  folder="cases"
                />
              </div>
              <button
                type="button"
                onClick={() => set('gallery', form.gallery.filter((_, idx) => idx !== i))}
                className="mt-6 shrink-0 rounded-lg border border-line px-2.5 py-2 text-slate-400 hover:border-red-200 hover:text-red-600"
                aria-label="删除图片"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('gallery', [...form.gallery, ''])}
            className="btn-outline w-full"
          >
            <Plus className="h-4 w-4" /> 添加一张图片
          </button>
        </div>

        <div className="mt-4">
          <label className="label">视频地址（可留空）</label>
          <input
            className="field"
            value={form.video}
            onChange={(e) => set('video', e.target.value)}
            placeholder="/api/files/2026/09/xxx.mp4"
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">SEO 与发布</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">SEO 标题</label>
            <input className="field" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
          </div>
          <div>
            <label className="label">SEO 描述</label>
            <input className="field" value={form.seoDesc} onChange={(e) => set('seoDesc', e.target.value)} />
          </div>
          <div>
            <label className="label">发布状态</label>
            <select
              className="field"
              value={form.status}
              onChange={(e) => set('status', e.target.value as CaseFormValue['status'])}
            >
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">发布</option>
              <option value="OFFLINE">下架</option>
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => set('isFeatured', e.target.checked)}
                className="h-4 w-4 rounded border-line text-brand-600"
              />
              首页推荐
            </label>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存案例
        </button>
        <button type="button" className="btn-outline" onClick={() => router.push('/admin/cases')}>
          返回列表
        </button>
      </div>
    </form>
  )
}
