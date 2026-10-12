'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2,
  Sparkles,
  TestTube,
  KeyRound,
  Star,
  Activity,
  Eye,
  EyeOff,
  Zap,
  Brain,
  Cloud,
  MessageSquare,
  Cpu,
  Bot,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Provider = {
  id: number
  provider: string
  name: string
  enabled: boolean
  apiKey: string | null
  apiBase: string | null
  model: string | null
  temperature: number
  maxTokens: number
  isDefault: boolean
  sort: number
}

type LogItem = {
  id: number
  memberId: number | null
  adminId: number | null
  provider: string
  model: string | null
  scene: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  durationMs: number
  success: boolean
  error: string | null
  createdAt: string
  member: { id: number; userId: string | null; name: string | null; nickname: string | null; phone: string | null } | null
  admin: { id: number; username: string; displayName: string } | null
}

const PROVIDER_META: Record<string, { label: string; icon: LucideIcon; gradient: string }> = {
  doubao: { label: '豆包', icon: Zap, gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
  deepseek: { label: 'DeepSeek', icon: Brain, gradient: 'linear-gradient(135deg, #2563eb, #4f46e5)' },
  qwen: { label: '通义千问', icon: Cloud, gradient: 'linear-gradient(135deg, #f97316, #f59e0b)' },
  ernie: { label: '文心一言', icon: MessageSquare, gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  glm: { label: '智谱 GLM', icon: Cpu, gradient: 'linear-gradient(135deg, #10b981, #14b8a6)' },
  openai: { label: 'OpenAI', icon: Bot, gradient: 'linear-gradient(135deg, #0f172a, #334155)' },
}

const SCENE_LABEL: Record<string, string> = {
  report_summary: '月报总结',
  report_analysis: '报表分析',
  assistant: 'AI 助手',
}

function providerLogo(p: Provider) {
  const meta = PROVIDER_META[p.provider]
  const Icon = meta?.icon || Sparkles
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
      style={{ background: meta?.gradient || 'linear-gradient(135deg,#667eea,#764ba2)' }}
    >
      <Icon className="h-5 w-5" />
    </span>
  )
}

function fmtTime(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtDuration(ms: number) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function AiConfigManager() {
  const [tab, setTab] = useState<'providers' | 'logs' | 'prompt'>('providers')
  const [list, setList] = useState<Provider[]>([])
  const [dailyLimit, setDailyLimit] = useState(20)
  const [reportMonths, setReportMonths] = useState(6)
  const [dailyDays, setDailyDays] = useState(30)
  const [maxImages, setMaxImages] = useState(12)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [testingId, setTestingId] = useState(0)
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; msg: string }>>({})
  const [showKey, setShowKey] = useState<Record<number, boolean>>({})

  const [logs, setLogs] = useState<LogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)

  const [promptText, setPromptText] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [promptSaving, setPromptSaving] = useState(false)

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai-config')
      const json = await res.json()
      if (json.code === 0) {
        setList(json.data.list)
        if (typeof json.data.dailyLimit === 'number') setDailyLimit(json.data.dailyLimit)
        if (typeof json.data.reportMonths === 'number') setReportMonths(json.data.reportMonths)
        if (typeof json.data.dailyDays === 'number') setDailyDays(json.data.dailyDays)
        if (typeof json.data.maxImages === 'number') setMaxImages(json.data.maxImages)
        if (typeof json.data.prompt === 'string') {
          setPromptText(json.data.prompt)
          setDefaultPrompt(json.data.prompt)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadLogs = useCallback(async (page = 1) => {
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/admin/ai/logs?page=${page}&pageSize=20`)
      const json = await res.json()
      if (json.code === 0) {
        setLogs(json.data.list)
        setLogTotal(json.data.total)
        setLogPage(page)
      }
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'logs') loadLogs(1)
  }, [tab, loadLogs])

  function patch(id: number, field: string, value: unknown) {
    setList((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  function setDefault(id: number) {
    setList((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimit,
          reportMonths,
          dailyDays,
          maxImages,
          providers: list.map((p) => ({
            id: p.id,
            enabled: p.enabled,
            apiKey: p.apiKey || '',
            apiBase: p.apiBase || '',
            model: p.model || '',
            temperature: p.temperature,
            maxTokens: p.maxTokens,
            isDefault: p.isDefault,
          })),
        }),
      })
      const json = await res.json()
      if (json.code !== 0) return notify(json.message || '保存失败')
      notify('AI 配置已保存')
    } finally {
      setSaving(false)
    }
  }

  async function test(p: Provider) {
    setTestingId(p.id)
    setTestResult((prev) => ({ ...prev, [p.id]: { ok: false, msg: '' } }))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch('/api/admin/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
        signal: controller.signal,
      })
      const json = await res.json()
      if (json.code === 0) {
        setTestResult((prev) => ({ ...prev, [p.id]: { ok: true, msg: `连接正常 · ${json.data.reply}` } }))
      } else {
        setTestResult((prev) => ({ ...prev, [p.id]: { ok: false, msg: json.message || '连接失败' } }))
      }
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      setTestResult((prev) => ({ ...prev, [p.id]: { ok: false, msg: aborted ? '连接超时' : '网络异常' } }))
    } finally {
      clearTimeout(timer)
      setTestingId(0)
    }
  }

  async function savePrompt() {
    setPromptSaving(true)
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      })
      const json = await res.json()
      if (json.code !== 0) return notify(json.message || '保存失败')
      setDefaultPrompt(promptText)
      notify('人设已保存')
    } finally {
      setPromptSaving(false)
    }
  }

  function resetPrompt() {
    setPromptText(defaultPrompt)
    notify('已恢复为上次保存的版本')
  }

  const enabledProviders = list.filter((p) => p.enabled)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-mist p-1">
        {[
          { key: 'providers' as const, label: '模型配置' },
          { key: 'prompt' as const, label: '人设管理' },
          { key: 'logs' as const, label: '调用记录' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition',
              tab === t.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'prompt' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <MessageSquare className="h-4 w-4 text-brand-600" /> AI 数据顾问人设（System Prompt）
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetPrompt}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                >
                  撤销修改
                </button>
                <button
                  type="button"
                  onClick={savePrompt}
                  disabled={promptSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {promptSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存人设
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              控制小程序「AI 数据顾问」的角色定位与回答规则。修改后立即生效，作用于后续所有客户对话；清空内容并保存可恢复内置默认人设。
            </p>

            <div className="mt-4">
              <textarea
                className="field min-h-[420px] w-full resize-y font-mono text-[13px] leading-relaxed"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="请输入 AI 数据顾问的人设与对话规则…"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>共 {promptText.length} 字</span>
                <span>建议保留「数据识别严谨、不猜数字、不虚假宣传」等核心规则</span>
              </div>
            </div>
          </div>
        </div>
      ) : tab === 'providers' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-line bg-white p-12 text-center text-slate-400">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* 顶部：默认模型单选 + 每日限额 + 保存 */}
              <div className="rounded-xl border border-line bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Star className="h-4 w-4 text-amber-500" /> 默认模型
                  </h3>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存配置
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">小程序「AI 助手」与后台「AI 生成总结 / 分析」统一使用下方选中的默认模型</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDefault(p.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                        p.isDefault ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-line bg-white hover:border-brand-200',
                      )}
                    >
                      {providerLogo(p)}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                        <span className="block truncate text-xs text-slate-400">{PROVIDER_META[p.provider]?.label || p.provider}</span>
                      </span>
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          p.isDefault ? 'border-brand-600' : 'border-slate-300',
                        )}
                      >
                        {p.isDefault ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                  <div>
                    <label className="label">每日 AI 对话限额（单个付费客户）</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="field w-28"
                        inputMode="numeric"
                        value={String(dailyLimit)}
                        onChange={(e) => setDailyLimit(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 20))}
                      />
                      <span className="text-xs text-slate-400">次 / 天，超出后提示联系顾问</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">AI 读取月报期数</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="field w-28"
                        inputMode="numeric"
                        value={String(reportMonths)}
                        onChange={(e) => setReportMonths(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 6))}
                      />
                      <span className="text-xs text-slate-400">期（近 N 个月，从新到旧）</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">AI 读取日报天数</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="field w-28"
                        inputMode="numeric"
                        value={String(dailyDays)}
                        onChange={(e) => setDailyDays(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 30))}
                      />
                      <span className="text-xs text-slate-400">天（近 N 天）</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">AI 读取截图张数</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="field w-28"
                        inputMode="numeric"
                        value={String(maxImages)}
                        onChange={(e) => setMaxImages(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 12))}
                      />
                      <span className="text-xs text-slate-400">张（月报+日报截图，最新优先）</span>
                    </div>
                  </div>
                  {enabledProviders.length === 0 ? (
                    <p className="text-xs text-amber-600">尚未启用任何模型，AI 功能将不可用</p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      当前启用：{enabledProviders.map((p) => p.name).join('、')}
                    </p>
                  )}
                </div>
              </div>

              {/* 模型卡片 */}
              <div className="grid gap-4 lg:grid-cols-2">
                {list.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      'rounded-xl border bg-white p-5 transition',
                      p.enabled ? 'border-brand-300' : 'border-line opacity-80',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {providerLogo(p)}
                        <div>
                          <div className="font-semibold text-ink">{p.name}</div>
                          <div className="text-xs text-slate-400">{PROVIDER_META[p.provider]?.label || p.provider}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => patch(p.id, 'enabled', !p.enabled)}
                        className={cn(
                          'relative h-6 w-11 rounded-full transition',
                          p.enabled ? 'bg-brand-600' : 'bg-slate-300',
                        )}
                        aria-label="启用开关"
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                            p.enabled ? 'left-[22px]' : 'left-0.5',
                          )}
                        />
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="label">API Key</label>
                        <div className="relative">
                          <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                          <input
                            type={showKey[p.id] ? 'text' : 'password'}
                            className="field pl-8 pr-10"
                            value={p.apiKey || ''}
                            onChange={(e) => patch(p.id, 'apiKey', e.target.value)}
                            placeholder="sk-..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                            aria-label="显示/隐藏 API Key"
                            tabIndex={-1}
                          >
                            {showKey[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">API 地址</label>
                        <input
                          className="field"
                          value={p.apiBase || ''}
                          onChange={(e) => patch(p.id, 'apiBase', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">模型名</label>
                          <input
                            className="field"
                            value={p.model || ''}
                            onChange={(e) => patch(p.id, 'model', e.target.value)}
                            placeholder="如 doubao-pro-4k"
                          />
                        </div>
                        <div>
                          <label className="label">最大 Token</label>
                          <input
                            className="field"
                            inputMode="numeric"
                            value={String(p.maxTokens)}
                            onChange={(e) => patch(p.id, 'maxTokens', Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 2000))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">温度（0~2，默认 0.7）</label>
                        <input
                          className="field"
                          inputMode="decimal"
                          value={String(p.temperature)}
                          onChange={(e) => patch(p.id, 'temperature', Math.min(2, Math.max(0, Number(e.target.value) || 0)))}
                        />
                      </div>
                      <div className="flex items-center justify-between border-t border-line pt-3">
                        <button
                          type="button"
                          onClick={() => test(p)}
                          disabled={testingId === p.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                        >
                          {testingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                          测试连接
                        </button>
                        {testResult[p.id] && testResult[p.id].msg ? (
                          <p
                            className={cn(
                              'flex items-center gap-1 text-xs',
                              testResult[p.id].ok ? 'text-green-600' : 'text-red-500',
                            )}
                          >
                            {testResult[p.id].ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                            {testResult[p.id].msg}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Activity className="h-4 w-4 text-brand-600" /> AI 调用记录
            </p>
            <span className="text-xs text-slate-400">共 {logTotal} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-medium">时间</th>
                  <th className="px-4 py-2.5 font-medium">调用方</th>
                  <th className="px-4 py-2.5 font-medium">模型</th>
                  <th className="px-4 py-2.5 font-medium">场景</th>
                  <th className="px-4 py-2.5 font-medium">耗时</th>
                  <th className="px-4 py-2.5 font-medium">Token</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">暂无调用记录</td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="transition hover:bg-mist/50">
                      <td className="px-4 py-2.5 text-xs text-slate-500">{fmtTime(l.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        {l.admin ? (
                          <span className="text-ink">{l.admin.displayName}（后台）</span>
                        ) : l.member ? (
                          <span className="text-ink">{l.member.name || l.member.nickname || l.member.userId || `客户#${l.member.id}`}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{l.model || l.provider}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{SCENE_LABEL[l.scene] || l.scene}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDuration(l.durationMs)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{l.totalTokens}</td>
                      <td className="px-4 py-2.5">
                        {l.success ? (
                          <span className="text-xs text-green-600">成功</span>
                        ) : (
                          <span className="text-xs text-red-500" title={l.error || ''}>失败</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <button
              type="button"
              disabled={logPage <= 1}
              onClick={() => loadLogs(logPage - 1)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-600 disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-xs text-slate-400">第 {logPage} 页</span>
            <button
              type="button"
              disabled={logPage * 20 >= logTotal}
              onClick={() => loadLogs(logPage + 1)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-600 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}