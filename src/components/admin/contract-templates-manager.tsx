'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, History, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { ImageField } from '@/components/admin/image-field'

const PLACEHOLDERS = [
  '{{合同编号}}',
  '{{甲方姓名}}',
  '{{甲方身份证}}',
  '{{甲方电话}}',
  '{{乙方名称}}',
  '{{乙方信用代码}}',
  '{{乙方电话}}',
  '{{乙方负责人}}',
  '{{乙方签署}}',
  '{{服务内容}}',
  '{{合同金额}}',
  '{{合同金额大写}}',
  '{{开始日期}}',
  '{{结束日期}}',
  '{{服务天数}}',
  '{{附加条款}}',
  '{{签署日期}}',
]

const SAMPLE: Record<string, string> = {
  '{{合同编号}}': 'ST2026092923400006AK8D',
  '{{甲方姓名}}': '张三',
  '{{甲方身份证}}': '430***************',
  '{{甲方电话}}': '138****0000',
  '{{乙方名称}}': '桃江闪途网络科技工作室（个体工商户）',
  '{{乙方信用代码}}': '92430900XXXX',
  '{{乙方电话}}': '16607370500',
  '{{乙方负责人}}': '负责人姓名',
  '{{乙方签署}}': '　负责人签字：负责人姓名',
  '{{服务内容}}': '1. 抖音账号代运营\n2. 平面设计服务',
  '{{合同金额}}': '¥3,000.00',
  '{{合同金额大写}}': '叁仟元整',
  '{{开始日期}}': '2026年09月29日',
  '{{结束日期}}': '2026年10月28日',
  '{{服务天数}}': '31',
  '{{附加条款}}': '1. 账号归属条款：账号所有权归甲方，乙方仅代运营',
  '{{签署日期}}': '2026年09月29日',
}

type Template = {
  id: number
  name: string
  contentHtml: string
  sealImageUrl: string | null
  partyBName: string
  partyBAddress: string
  partyBPhone: string
  partyBCreditCode: string
  partyBType: string
  partyBLegalRep: string
  isDefault: boolean
  version: number
  updatedAt: string
  _count?: { versions: number }
}

type TemplateVersion = {
  id: number
  version: number
  name: string
  createdAt: string
}

type Clause = {
  id: number
  name: string
  content: string
  isActive: boolean
  isBuiltin: boolean
  sort: number
}

function preview(html: string): string {
  let out = html
  for (const [k, v] of Object.entries(SAMPLE)) out = out.split(k).join(v)
  return out
}

export function ContractTemplatesManager() {
  const [tab, setTab] = useState<'templates' | 'clauses'>('templates')

  // 模板状态
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Template | null>(null)
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  // AI 生成
  const [aiServiceType, setAiServiceType] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  // 条款状态
  const [clauses, setClauses] = useState<Clause[]>([])
  const [clauseForm, setClauseForm] = useState<{ id?: number; name: string; content: string } | null>(null)

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  /** 拉取模板列表并返回列表本身（不自动改动编辑区，避免覆盖「新建」态） */
  const loadTemplates = useCallback(async (): Promise<Template[]> => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/contract-templates')
      const data = await res.json()
      const list: Template[] = data.code === 0 ? data.data.list : []
      setTemplates(list)
      return list
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadClauses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/contract-clauses')
      const data = await res.json()
      if (data.code === 0) setClauses(data.data.list)
    } catch {
      /* 忽略 */
    }
  }, [])

  /** 首次进入：拉列表并默认选中第一个模板 */
  useEffect(() => {
    ;(async () => {
      const list = await loadTemplates()
      if (list.length) selectTemplate(list[0])
    })()
    loadClauses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadVersions(id: number) {
    try {
      const res = await fetch(`/api/admin/contract-templates/${id}/versions`)
      const data = await res.json()
      if (data.code === 0) setVersions(data.data.list)
    } catch {
      /* 忽略 */
    }
  }

  function selectTemplate(t: Template) {
    setCreating(false)
    setSelected(t)
    setEditing({ ...t })
    setVersions([])
    loadVersions(t.id)
  }

  /** 新建模板：进入独立的「新建态」，不会被列表自动选中覆盖 */
  function newTemplate() {
    setCreating(true)
    setSelected(null)
    setVersions([])
    setEditing({
      id: 0,
      name: '',
      contentHtml: '',
      sealImageUrl: null,
      partyBName: '桃江闪途网络科技工作室（个体工商户）',
      partyBAddress: '',
      partyBPhone: '16607370500',
      partyBCreditCode: '92430922MAEP037J3G',
      partyBType: 'individual',
      partyBLegalRep: '文智',
      isDefault: false,
      version: 1,
      updatedAt: '',
    })
  }

  async function deleteTemplate(id: number, name: string) {
    if (!confirm(`确定删除模板「${name}」？删除后不可恢复（已生成的合同不受影响）。`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/contract-templates/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.code !== 0) {
        notify(data.message || '删除失败')
        return
      }
      notify('模板已删除')
      const list = await loadTemplates()
      if (list.length) selectTemplate(list[0])
      else {
        setCreating(false)
        setSelected(null)
        setEditing(null)
      }
    } finally {
      setBusy(false)
    }
  }

  async function saveTemplate() {
    if (!editing || !editing.name.trim() || !editing.contentHtml.trim()) {
      notify('请填写模板名称和合同正文')
      return
    }
    setBusy(true)
    try {
      const isNew = !editing.id
      const url = isNew ? '/api/admin/contract-templates' : `/api/admin/contract-templates/${editing.id}`
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          contentHtml: editing.contentHtml,
          partyBName: editing.partyBName,
          partyBAddress: editing.partyBAddress || '',
          partyBPhone: editing.partyBPhone || '',
          partyBCreditCode: editing.partyBCreditCode || '',
          partyBType: editing.partyBType || 'individual',
          partyBLegalRep: editing.partyBLegalRep || '',
          sealImageUrl: editing.sealImageUrl || '',
          isDefault: editing.isDefault,
        }),
      })
      const data = await res.json()
      if (data.code === 0) {
        notify(isNew ? '模板已创建' : '已保存为新版本')
        const savedId: number = data.data?.id || editing.id
        const list = await loadTemplates()
        const target = list.find((t) => t.id === savedId)
        if (target) selectTemplate(target)
      } else {
        notify(data.message || '保存失败')
      }
    } finally {
      setBusy(false)
    }
  }

  async function rollback(v: number) {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/contract-templates/${selected.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: v }),
      })
      const data = await res.json()
      if (data.code === 0) {
        notify('已回滚')
        setSelected(null)
        await loadTemplates()
      } else {
        notify(data.message || '回滚失败')
      }
    } finally {
      setBusy(false)
    }
  }

  async function aiGenerate() {
    if (!aiServiceType.trim()) {
      notify('请填写服务类型')
      return
    }
    setAiBusy(true)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 120000)
      const res = await fetch('/api/admin/contract-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: aiServiceType.trim(), packageName: editing?.name || '' }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.code === 0 && data.data.contentHtml) {
        setEditing((prev) => (prev ? { ...prev, contentHtml: data.data.contentHtml } : prev))
        notify('AI 已生成合同正文，请检查后保存')
      } else {
        notify(data.message || '生成失败')
      }
    } catch (e: any) {
      notify(e?.name === 'AbortError' ? 'AI 生成超时，请重试' : '生成失败，请检查网络后重试')
    } finally {
      setAiBusy(false)
    }
  }

  async function saveClause() {
    if (!clauseForm || !clauseForm.name.trim() || !clauseForm.content.trim()) {
      notify('请填写条款名称和内容')
      return
    }
    try {
      const url = clauseForm.id ? `/api/admin/contract-clauses/${clauseForm.id}` : '/api/admin/contract-clauses'
      const method = clauseForm.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clauseForm.name, content: clauseForm.content }),
      })
      const data = await res.json()
      if (data.code === 0) {
        setClauseForm(null)
        await loadClauses()
        notify('已保存')
      } else {
        notify(data.message || '保存失败')
      }
    } catch {
      notify('保存失败')
    }
  }

  async function deleteClause(id: number) {
    try {
      const res = await fetch(`/api/admin/contract-clauses/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.code === 0) await loadClauses()
    } catch {
      notify('删除失败')
    }
  }

  return (
    <div className="space-y-4">
      {toast ? <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{toast}</div> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('templates')}
          className={`rounded-full px-4 py-2 text-sm ${tab === 'templates' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}
        >
          合同模板
        </button>
        <button
          type="button"
          onClick={() => setTab('clauses')}
          className={`rounded-full px-4 py-2 text-sm ${tab === 'clauses' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}
        >
          附加条款库
        </button>
      </div>

      {tab === 'templates' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 模板列表 */}
          <div className="rounded-xl border border-line bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">模板列表</span>
              <button
                type="button"
                onClick={newTemplate}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-3.5 w-3.5" /> 新建
              </button>
            </div>
            <div className="space-y-1">
              {loading ? (
                <div className="flex justify-center py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">暂无模板</div>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.id}
                    className={`group flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      selected?.id === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-mist'
                    }`}
                  >
                    <button type="button" onClick={() => selectTemplate(t)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate">{t.name}</span>
                    </button>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      {t.isDefault ? <span className="text-brand-600">默认</span> : null}
                      v{t.version}
                      <button
                        type="button"
                        title="删除模板"
                        onClick={() => deleteTemplate(t.id, t.name)}
                        className="ml-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 编辑器 */}
          <div className="space-y-4 lg:col-span-2">
            {editing ? (
              <div className="rounded-xl border border-line bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {creating ? '新建合同模板' : selected ? `编辑模板 · ${selected.name}` : '模板编辑'}
                  </span>
                  {creating ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">新建中（未保存）</span>
                  ) : null}
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <label className="text-sm text-slate-600">
                    模板名称
                    <input
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    乙方名称
                    <input
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                      value={editing.partyBName}
                      onChange={(e) => setEditing({ ...editing, partyBName: e.target.value })}
                    />
                  </label>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-3">
                  <label className="text-sm text-slate-600">
                    主体类型
                    <select
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                      value={editing.partyBType}
                      onChange={(e) => setEditing({ ...editing, partyBType: e.target.value })}
                    >
                      <option value="individual">个体工商户（负责人签字）</option>
                      <option value="company">公司（公章盖章）</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-600">
                    统一社会信用代码
                    <input
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                      value={editing.partyBCreditCode}
                      onChange={(e) => setEditing({ ...editing, partyBCreditCode: e.target.value })}
                      placeholder="如 92430900XXXX"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    联系电话
                    <input
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                      value={editing.partyBPhone}
                      onChange={(e) => setEditing({ ...editing, partyBPhone: e.target.value })}
                      placeholder="16607370500"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    负责人姓名（个体户签字用）
                    <input
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                      value={editing.partyBLegalRep}
                      onChange={(e) => setEditing({ ...editing, partyBLegalRep: e.target.value })}
                      placeholder="个体户负责人姓名"
                    />
                  </label>
                </div>

                <div className="mb-3">
                  <label className="label">公司公章（仅「公司」主体盖章时使用；个体户为负责人签字，无需公章）</label>
                  {editing.sealImageUrl ? (
                    <div className="mb-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editing.sealImageUrl}
                        alt="公司公章"
                        className="h-16 w-16 rounded-lg border border-line bg-white object-contain p-1"
                      />
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, sealImageUrl: '' })}
                        className="text-xs text-slate-400 hover:text-red-500"
                      >
                        移除公章
                      </button>
                    </div>
                  ) : null}
                  <ImageField
                    label="公章图片（PNG 透明底）"
                    value={editing.sealImageUrl || ''}
                    onChange={(url) => setEditing({ ...editing, sealImageUrl: url })}
                    folder="seal"
                  />
                </div>

                <div className="mb-2 flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={editing.isDefault}
                      onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
                    />
                    设为默认模板
                  </label>
                </div>

                <div className="mb-2 flex flex-wrap gap-1">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditing({ ...editing, contentHtml: editing.contentHtml + p })}
                      className="rounded bg-mist px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <input
                    className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                    placeholder="AI 生成：输入服务类型，如「抖音代运营」"
                    value={aiServiceType}
                    onChange={(e) => setAiServiceType(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={aiGenerate}
                    className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiBusy ? '生成中…' : 'AI 生成'}
                  </button>
                </div>
                <div className="mb-3 text-xs text-slate-500">
                  AI 起草一份完整合同约需 20–40 秒，请耐心等待；生成后会填入下方正文，你可继续编辑后再保存。
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-slate-500">正文 HTML（含占位符）</div>
                    <textarea
                      className="h-[420px] w-full rounded-md border border-line p-3 font-mono text-xs outline-none focus:border-brand-300"
                      value={editing.contentHtml}
                      onChange={(e) => setEditing({ ...editing, contentHtml: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-slate-500">实时预览</div>
                    <div
                      className="h-[420px] overflow-y-auto rounded-md border border-line bg-mist p-3 text-sm leading-relaxed text-slate-700"
                      dangerouslySetInnerHTML={{ __html: preview(editing.contentHtml) }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  {selected && selected.id ? (
                    <button
                      type="button"
                      onClick={() => loadVersions(selected.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-2 text-sm text-slate-600 hover:bg-mist"
                    >
                      <History className="h-4 w-4" /> 版本历史
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveTemplate}
                    className="rounded-full bg-brand-600 px-5 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {busy ? '保存中...' : creating ? '创建模板' : '保存（新版本）'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* 版本历史 */}
            {versions.length > 0 ? (
              <div className="rounded-xl border border-line bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600">
                  <FileText className="h-4 w-4" /> 版本历史
                </div>
                <div className="space-y-1">
                  {versions.map((v) => (
                    <div key={v.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-mist">
                      <span className="text-slate-600">v{v.version} · {v.name}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString('zh-CN')}</span>
                        <button
                          type="button"
                          onClick={() => rollback(v.version)}
                          className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" /> 回滚
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* 附加条款库 */
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">附加条款库（下单时勾选，自动加到合同「其他约定」）</span>
            <button
              type="button"
              onClick={() => setClauseForm({ name: '', content: '' })}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" /> 新增条款
            </button>
          </div>

          {clauseForm ? (
            <div className="mb-3 rounded-lg bg-mist p-3">
              <input
                className="mb-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none"
                placeholder="条款名称，如「营业额分成条款」"
                value={clauseForm.name}
                onChange={(e) => setClauseForm({ ...clauseForm, name: e.target.value })}
              />
              <textarea
                className="mb-2 w-full rounded-md border border-line p-3 text-sm outline-none"
                rows={3}
                placeholder="条款内容"
                value={clauseForm.content}
                onChange={(e) => setClauseForm({ ...clauseForm, content: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setClauseForm(null)} className="rounded-full border border-line px-4 py-1.5 text-sm text-slate-600 hover:bg-white">
                  取消
                </button>
                <button type="button" onClick={saveClause} className="rounded-full bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-700">
                  保存
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {clauses.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">暂无条款</div>
            ) : (
              clauses.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700">
                      {c.name}
                      {c.isBuiltin ? <span className="ml-2 text-xs text-slate-400">内置</span> : null}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{c.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setClauseForm({ id: c.id, name: c.name, content: c.content })}
                      className="text-xs text-slate-500 hover:text-brand-700"
                    >
                      编辑
                    </button>
                    <button type="button" onClick={() => deleteClause(c.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
