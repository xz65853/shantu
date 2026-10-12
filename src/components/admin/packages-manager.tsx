'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageField } from '@/components/admin/image-field'

export type PackageRow = {
  id: number
  name: string
  slug: string
  period: string
  periodDays: number | null
  price: number // 分（兼容字段 = 首个 SKU 价格）
  originalPrice: number | null
  summary: string | null
  cover: string | null
  features: string | null
  recommended: boolean
  status: number
  sort: number
  templateId: number | null
  skus: SkuRow[]
}

export type SkuRow = {
  id: number
  name: string
  price: number // 分
  originalPrice: number | null
  serviceDays: number
  sort: number
  status: number
  features?: string | null // 服务内容 JSON 数组（每个 SKU 可不同）
}

type SkuDraft = {
  id?: number
  name: string
  price: string // 元
  originalPrice: string // 元
  serviceDays: string
  features: string // 每行一条
  sort: number
  status: number
}

type Draft = {
  id?: number
  name: string
  slug: string
  summary: string
  cover: string
  features: string // 每行一条
  recommended: boolean
  status: number
  sort: number
  templateId: string
  serviceTypeId: string
  skus: SkuDraft[]
}

const EMPTY_SKU: SkuDraft = {
  name: '',
  price: '',
  originalPrice: '',
  serviceDays: '31',
  features: '',
  sort: 0,
  status: 1,
}

const EMPTY: Draft = {
  name: '',
  slug: '',
  summary: '',
  cover: '',
  features: '',
  recommended: false,
  status: 1,
  sort: 0,
  templateId: '',
  serviceTypeId: '',
  skus: [{ ...EMPTY_SKU }],
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

/** 服务内容（JSON 数组字符串）→ 文本框文本（每行一条） */
function featuresToText(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').join('\n') : ''
  } catch {
    return ''
  }
}

/** 文本框文本 → 服务内容数组 */
function textToFeatures(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function PackagesManager({ initial }: { initial: PackageRow[] }) {
  const [rows, setRows] = useState<PackageRow[]>(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [serviceTypes, setServiceTypes] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    fetch('/api/admin/service-types').then(r=>r.json()).then(d=>{if(d.code===0)setServiceTypes(d.data.filter((x:any)=>x.enabled))}).catch(()=>{})
    fetch('/api/admin/contract-templates')
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 0) setTemplates(data.data.list || [])
      })
      .catch(() => undefined)
  }, [])

  function openNew() {
    setDraft({ ...EMPTY, skus: [{ ...EMPTY_SKU }] })
    setError('')
    setMessage('')
  }

  function openEdit(row: PackageRow) {
    let features = ''
    if (row.features) {
      try {
        const arr = JSON.parse(row.features)
        if (Array.isArray(arr)) features = arr.join('\n')
      } catch {
        features = ''
      }
    }
    const skus: SkuDraft[] = (row.skus && row.skus.length ? row.skus : []).map((s) => ({
      id: s.id,
      name: s.name,
      price: String(s.price / 100),
      originalPrice: s.originalPrice ? String(s.originalPrice / 100) : '',
      serviceDays: String(s.serviceDays),
      features: featuresToText(s.features),
      sort: s.sort,
      status: s.status,
    }))
    setDraft({
      id: row.id,
      name: row.name,
      slug: row.slug,
      summary: row.summary || '',
      cover: row.cover || '',
      features,
      recommended: row.recommended,
      status: row.status,
      sort: row.sort,
      templateId: row.templateId ? String(row.templateId) : '',
      serviceTypeId: (row as any).serviceTypeId ? String((row as any).serviceTypeId) : '',
      skus: skus.length ? skus : [{ ...EMPTY_SKU }],
    })
    setError('')
    setMessage('')
  }

  async function refresh() {
    const res = await fetch('/api/admin/packages').then((r) => r.json())
    if (res?.code === 0) setRows(res.data)
  }

  function addSku() {
    setDraft((d) => (d ? { ...d, skus: [...d.skus, { ...EMPTY_SKU }] } : d))
  }
  function updateSku(i: number, patch: Partial<SkuDraft>) {
    setDraft((d) =>
      d ? { ...d, skus: d.skus.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) } : d,
    )
  }
  function removeSku(i: number) {
    setDraft((d) => (d ? { ...d, skus: d.skus.filter((_, idx) => idx !== i) } : d))
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setError('')
    try {
      const validSkus = draft.skus
        .filter((s) => s.name.trim())
        .map((s) => ({
          id: s.id,
          name: s.name.trim(),
          price: Number(s.price || 0),
          originalPrice: s.originalPrice ? Number(s.originalPrice) : null,
          serviceDays: Number(s.serviceDays || 1),
          features: textToFeatures(s.features || ''),
          sort: s.sort || 0,
          status: s.status ?? 1,
        }))
      if (!validSkus.length) {
        setError('请至少填写一个 SKU 规格')
        setSaving(false)
        return
      }
      const first = validSkus[0]
      const payload = {
        name: draft.name,
        slug: draft.slug,
        // 兼容字段：套餐表保留首 SKU 的价格/周期/天数（老下单逻辑回退用）
        period: first.name,
        periodDays: first.serviceDays,
        price: first.price,
        originalPrice: first.originalPrice,
        summary: draft.summary,
        cover: draft.cover,
        features: draft.features
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        skus: validSkus,
        recommended: draft.recommended,
        status: draft.status,
        sort: draft.sort,
        templateId: draft.templateId ? Number(draft.templateId) : null,
        serviceTypeId: draft.serviceTypeId ? Number(draft.serviceTypeId) : null,
      }
      const res = await fetch(
        draft.id ? `/api/admin/packages/${draft.id}` : '/api/admin/packages',
        {
          method: draft.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      setMessage(json.message || '已保存')
      setDraft(null)
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: PackageRow) {
    if (
      !confirm(
        `确定删除套餐「${row.name}」及其所有规格？\n历史订单会保留，套餐信息以订单快照为准。`,
      )
    )
      return
    const res = await fetch(`/api/admin/packages/${row.id}`, { method: 'DELETE' }).then((r) => r.json())
    setMessage(res?.message || '已处理')
    await refresh()
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {message ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>
      ) : null}

      <div className="flex justify-end">
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> 新增套餐
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-mist text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">套餐</th>
              <th className="px-4 py-3 font-medium">规格数</th>
              <th className="px-4 py-3 font-medium">价格区间</th>
              <th className="px-4 py-3 font-medium">推荐</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">排序</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const prices = (r.skus || []).filter((s) => s.status === 1).map((s) => s.price)
                const min = prices.length ? Math.min(...prices) : r.price
                const max = prices.length ? Math.max(...prices) : r.price
                const rangeText = min === max ? `¥${yuan(min)}` : `¥${yuan(min)} - ¥${yuan(max)}`
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{r.name}</div>
                      <div className="text-xs text-slate-400">/{r.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{(r.skus || []).length} 个规格</td>
                    <td className="px-4 py-3 font-medium text-ink">{rangeText}</td>
                    <td className="px-4 py-3">
                      {r.recommended ? (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">推荐</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          r.status === 1 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {r.status === 1 ? '上架' : '下架'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.sort}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-slate-600 hover:border-brand-200 hover:text-brand-700"
                        >
                          <Pencil className="h-3.5 w-3.5" /> 编辑
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-slate-600 hover:border-red-200 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> 删除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  还没有套餐，点击右上角新增
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">
                {draft.id ? '编辑套餐' : '新增套餐'}
              </h2>
              <button onClick={() => setDraft(null)} className="text-slate-400 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">套餐名称 *</label>
                <input
                  className="field"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="如：抖音代运营"
                />
              </div>
              <div>
                <label className="label">标识（URL 用）*</label>
                <input
                  className="field"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="douyin-operation"
                />
              </div>
              <div className="sm:col-span-2">
                <ImageField
                  label="套餐封面图（详情页顶部）"
                  value={draft.cover}
                  onChange={(url) => setDraft({ ...draft, cover: url })}
                  folder="package"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">一句话说明</label>
                <input
                  className="field"
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                  placeholder="如：适合刚开始做线上、想先跑通内容的商家"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">服务内容（每行一条）</label>
                <textarea
                  className="field min-h-[100px]"
                  value={draft.features}
                  onChange={(e) => setDraft({ ...draft, features: e.target.value })}
                  placeholder={'账号定位与内容规划\n每月 12 条短视频\n数据复盘与优化建议'}
                />
              </div>
            </div>

            {/* SKU 规格管理 */}
            <div className="mt-6 rounded-xl border border-line bg-mist/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">SKU 规格（价格 / 周期）</h3>
                <button
                  type="button"
                  onClick={addSku}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-brand-700 hover:border-brand-300"
                >
                  <Plus className="h-3.5 w-3.5" /> 新增规格
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {draft.skus.map((s, i) => (
                  <div key={i} className="rounded-lg border border-line bg-white p-3">
                    <div className="grid items-end gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-3">
                        <label className="label">规格名称</label>
                        <input
                          className="field"
                          value={s.name}
                          onChange={(e) => updateSku(i, { name: e.target.value })}
                          placeholder="月度代运营"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">价格（元）</label>
                        <input
                          className="field"
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={s.price}
                          onChange={(e) => updateSku(i, { price: e.target.value })}
                          placeholder="3000"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">划线价（元）</label>
                        <input
                          className="field"
                          type="number"
                          min={0}
                          step="0.01"
                          value={s.originalPrice}
                          onChange={(e) => updateSku(i, { originalPrice: e.target.value })}
                          placeholder="选填"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">服务天数</label>
                        <input
                          className="field"
                          type="number"
                          min={1}
                          value={s.serviceDays}
                          onChange={(e) => updateSku(i, { serviceDays: e.target.value })}
                          placeholder="31"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">排序（数字越小越靠前）</label>
                        <input
                          className="field w-full min-w-[92px] text-center"
                          type="number"
                          value={s.sort}
                          onChange={(e) => updateSku(i, { sort: Number(e.target.value) })}
                          placeholder="0"
                        />
                      </div>
                      <div className="sm:col-span-1 flex items-center justify-end gap-2 pb-1">
                        <button
                          type="button"
                          onClick={() => removeSku(i)}
                          disabled={draft.skus.length <= 1}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                          title="删除规格"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid items-start gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-10">
                        <label className="label">该规格的服务内容（每行一条）</label>
                        <textarea
                          className="field min-h-[76px]"
                          value={s.features}
                          onChange={(e) => updateSku(i, { features: e.target.value })}
                          placeholder={
                            draft.features.trim() ||
                            '留空则沿用套餐服务内容，例如：\n每月 12 条短视频\n专属运营对接群\n月度数据复盘报告'
                          }
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-3 pt-6">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={s.status === 1}
                            onChange={(e) => updateSku(i, { status: e.target.checked ? 1 : 0 })}
                          />
                          上架
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">合同模板</label>
                <select
                  className="field"
                  value={draft.templateId}
                  onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}
                >
                  <option value="">跟随默认模板</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">服务类型</label>
                <select
                  className="field"
                  value={draft.serviceTypeId}
                  onChange={(e) => setDraft({ ...draft, serviceTypeId: e.target.value })}
                >
                  <option value="">不绑定</option>
                  {serviceTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">排序</label>
                <input
                  className="field"
                  type="number"
                  value={draft.sort}
                  onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-6 pt-5">
                <div className="flex items-center gap-2">
                  <input
                    id="pkg-recommended"
                    type="checkbox"
                    checked={draft.recommended}
                    onChange={(e) => setDraft({ ...draft, recommended: e.target.checked })}
                  />
                  <label htmlFor="pkg-recommended" className="text-sm text-slate-600">
                    设为推荐套餐
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="pkg-status"
                    type="checkbox"
                    checked={draft.status === 1}
                    onChange={(e) => setDraft({ ...draft, status: e.target.checked ? 1 : 0 })}
                  />
                  <label htmlFor="pkg-status" className="text-sm text-slate-600">
                    上架显示
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={save} className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
              </button>
              <button
                onClick={() => setDraft(null)}
                className="rounded-lg border border-line px-4 py-2 text-sm text-slate-600"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
