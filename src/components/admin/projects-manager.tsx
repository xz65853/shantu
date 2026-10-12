'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sanitizeName } from '@/lib/name-utils';
import { BarChart3, CalendarDays, Loader2, Pencil, Plus, Search, Trash2, X, Sparkles, LineChart } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { ImagesField } from './images-field'
import { ServicePeriodsDialog } from './service-periods-dialog'

type MemberBrief = {
  id: number
  userId: string | null
  name: string | null
  nickname: string | null
  realName: string | null
  phone: string | null
}

type Project = {
  id: number
  name: string
  projectNo: string | null
  memberId: number
  orderId: number | null
  packageName: string | null
  serviceDesc: string | null
  manager: string | null
  startAt: string | null
  endAt: string | null
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'DONE'
  note: string | null
  createdAt: string
  member: MemberBrief
  _count: { reports: number }
}

type Report = {
  id: number
  projectId: number
  month: string
  videos: number
  lives: number
  views: number
  newFans: number
  leads: number
  deals: number
  gmv: number
  summary: string | null
  nextPlan: string | null
  images: string[]
}

type DailyLog = {
  id: number
  workDate: string
  content: string
  videos: number
  lives: number
  views: number
  newFans: number
  leads: number
  deals: number
  gmv: number
  summary: string
  images: string[]
  createdAt: string
}

const STATUS_LABEL: Record<Project['status'], string> = {
  PENDING: '待开始',
  RUNNING: '进行中',
  PAUSED: '已暂停',
  DONE: '已完成',
}
const STATUS_STYLE: Record<Project['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  RUNNING: 'bg-green-50 text-green-700',
  PAUSED: 'bg-slate-100 text-slate-500',
  DONE: 'bg-brand-50 text-brand-700',
}

function memberName(m: MemberBrief) {
  return sanitizeName(m.realName || m.name || m.nickname) || m.phone || `客户#${m.id}`
}
/** 项目名称自动生成：实名姓名-项目服务-月日（如 张三-季度代运营-1008） */
function autoProjectName(m: MemberBrief | null, pkg: string) {
  const n = m ? memberName(m) : ''
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return [n, pkg, mm + dd].filter((s) => s && s.trim()).join('-')
}
function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function ProjectsManager() {
  const [list, setList] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [busyId, setBusyId] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [reportsProject, setReportsProject] = useState<Project | null>(null)
  const [periodsProject, setPeriodsProject] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/projects')
      const json = await res.json()
      if (json.code === 0) setList(json.data.list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (status && p.status !== status) return false
      if (query) {
        const hay = `${p.name} ${p.projectNo || ''} ${memberName(p.member)} ${p.member.phone || ''} ${p.packageName || ''} ${p.manager || ''}`
        if (!hay.toLowerCase().includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [list, status, query])

  const stats = useMemo(() => {
    return {
      total: list.length,
      running: list.filter((p) => p.status === 'RUNNING').length,
      pending: list.filter((p) => p.status === 'PENDING').length,
      done: list.filter((p) => p.status === 'DONE').length,
    }
  }, [list])

  async function changeStatus(p: Project, next: Project['status']) {
    setBusyId(p.id)
    try {
      const res = await fetch(`/api/admin/projects/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json()
      if (json.code !== 0) return notify(json.message || '操作失败')
      notify('状态已更新')
      await load()
    } finally {
      setBusyId(0)
    }
  }

  async function removeProject() {
    if (!deleting) return
    setBusyId(deleting.id)
    try {
      const res = await fetch(`/api/admin/projects/${deleting.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.code !== 0) return notify(json.message || '删除失败')
      notify('项目已删除')
      setDeleting(null)
      await load()
    } finally {
      setBusyId(0)
    }
  }

  return (
    <div className="space-y-4">
      {/* 统计 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '全部项目', value: stats.total },
          { label: '进行中', value: stats.running },
          { label: '待开始', value: stats.pending },
          { label: '已完成', value: stats.done },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: '', label: '全部' },
          { v: 'PENDING', label: '待开始' },
          { v: 'RUNNING', label: '进行中' },
          { v: 'PAUSED', label: '已暂停' },
          { v: 'DONE', label: '已完成' },
        ].map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setStatus(t.v)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm transition',
              status === t.v ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:border-brand-200',
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm text-white transition hover:bg-brand-700"
        >
          <Plus className="h-3.5 w-3.5" /> 新建项目
        </button>
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(keyword)
          }}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              className="field w-56 pl-8"
              placeholder="搜索项目 / 客户 / 负责人"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">
            搜索
          </button>
        </form>
      </div>

      {/* 列表 */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">项目</th>
              <th className="px-4 py-3 font-medium">编号</th>
              <th className="px-4 py-3 font-medium">客户</th>
              <th className="px-4 py-3 font-medium">套餐 / 服务</th>
              <th className="px-4 py-3 font-medium">负责人</th>
              <th className="px-4 py-3 font-medium">服务周期</th>
              <th className="px-4 py-3 font-medium">报告</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                  暂无项目。点击「新建项目」为客户创建服务项目。
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="transition hover:bg-mist/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">创建于 {formatDate(p.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-600">{p.projectNo || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-ink">{memberName(p.member)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{p.member.phone || '—'}</p>
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    <p className="truncate text-slate-600">{p.packageName || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.manager || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {p.startAt ? formatDate(p.startAt) : '未定'}
                    {' ~ '}
                    {p.endAt ? formatDate(p.endAt) : '未定'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setReportsProject(p)}
                      className="inline-flex items-center gap-1 text-slate-600 transition hover:text-brand-700"
                      title="管理月度运营报告"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      {p._count.reports}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={cn('rounded-full px-2.5 py-1 text-xs outline-none transition', STATUS_STYLE[p.status])}
                      value={p.status}
                      disabled={busyId === p.id}
                      onChange={(e) => changeStatus(p, e.target.value as Project['status'])}
                    >
                      {(Object.keys(STATUS_LABEL) as Project['status'][]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPeriodsProject(p)}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                      >
                        <CalendarDays className="h-3.5 w-3.5" /> 周期
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p)
                          setShowForm(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                      >
                        <Pencil className="h-3.5 w-3.5" /> 编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(p)}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 transition hover:border-red-200 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> 删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <ProjectFormDialog
          project={editing}
          onClose={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false)
            load()
          }}
        />
      ) : null}
      {reportsProject ? (
        <ReportsDialog project={reportsProject} onClose={() => setReportsProject(null)} onChanged={load} />
      ) : null}
      {periodsProject ? (
        <ServicePeriodsDialog project={periodsProject} onClose={() => setPeriodsProject(null)} onChanged={load} />
      ) : null}
      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-ink">确认删除项目？</h3>
            <p className="mt-2 text-sm text-slate-500">
              将删除「{deleting.name}」及其全部 {deleting._count.reports} 份运营报告，且客户在小程序端将立即不可见。此操作不可恢复。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="rounded-lg border border-line px-4 py-2 text-sm">
                取消
              </button>
              <button
                type="button"
                onClick={removeProject}
                disabled={busyId === deleting.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {busyId === deleting.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

/* ---------------- 新建 / 编辑项目 ---------------- */

function ProjectFormDialog({
  project,
  onClose,
  onDone,
}: {
  project: Project | null
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = Boolean(project)
  const [name, setName] = useState(project?.name || '')
  const [nameTouched, setNameTouched] = useState(false)
  const [member, setMember] = useState<MemberBrief | null>(project?.member || null)
  const [packageName, setPackageName] = useState(project?.packageName || '')
  const [manager, setManager] = useState(project?.manager || '')
  const [startAt, setStartAt] = useState(project?.startAt ? project.startAt.slice(0, 10) : '')
  const [endAt, setEndAt] = useState(project?.endAt ? project.endAt.slice(0, 10) : '')
  const [status, setStatus] = useState<Project['status']>(project?.status || 'PENDING')
  const [serviceDesc, setServiceDesc] = useState(project?.serviceDesc || '')
  const [note, setNote] = useState(project?.note || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 自动命名：新建项目时选客户/填服务后自动生成「实名姓名-服务-月日」；手动改过则不再覆盖
  function handleMember(m: MemberBrief | null) {
    setMember(m)
    if (!isEdit && !nameTouched) setName(autoProjectName(m, packageName))
  }
  function handlePackage(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setPackageName(v)
    if (!isEdit && !nameTouched) setName(autoProjectName(member, v))
  }
  function handleName(e: React.ChangeEvent<HTMLInputElement>) {
    setName(e.target.value)
    setNameTouched(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('请填写项目名称')
    if (!member) return setError('请选择绑定客户')
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        ...(isEdit ? {} : { memberId: member.id }),
        packageName: packageName || null,
        manager: manager || null,
        startAt: startAt || null,
        endAt: endAt || null,
        status,
        serviceDesc: serviceDesc || null,
        note: note || null,
      }
      const res = await fetch(isEdit ? `/api/admin/projects/${project!.id}` : '/api/admin/projects', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || '保存失败')
      onDone()
    } catch {
      setError('网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{isEdit ? '编辑项目' : '新建项目'}</h3>
          <button type="button" onClick={onClose} className="text-slate-300 transition hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label">项目名称 *</label>
            <input className="field" value={name} onChange={handleName} placeholder="选择客户与服务后自动生成：实名姓名-服务-月日" maxLength={60} />
          </div>
          <div>
            <label className="label">绑定客户 *</label>
            {isEdit ? (
              <p className="rounded-lg bg-mist px-3 py-2 text-sm text-slate-600">
                {memberName(project!.member)}（{project!.member.phone || '无手机号'}）· 创建后不可更换
              </p>
            ) : (
              <MemberPicker value={member} onChange={handleMember} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">套餐 / 服务</label>
              <input className="field" value={packageName} onChange={handlePackage} placeholder="如：季度代运营" maxLength={60} />
            </div>
            <div>
              <label className="label">项目负责人</label>
              <input className="field" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="运营负责人姓名" maxLength={20} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">开始日期</label>
              <input type="date" className="field" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label className="label">结束日期</label>
              <input type="date" className="field" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">项目状态</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABEL) as Project['status'][]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm transition',
                    status === s ? 'bg-ink text-white' : 'border border-line text-slate-600',
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">服务内容说明</label>
            <textarea className="field min-h-[72px]" value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} placeholder="交付范围、账号信息、特殊约定等（仅后台可见）" maxLength={2000} />
          </div>
          <div>
            <label className="label">内部备注</label>
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="选填，仅后台可见" maxLength={2000} />
          </div>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
              取消
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ---------------- 客户搜索选择器 ---------------- */

function MemberPicker({ value, onChange }: { value: MemberBrief | null; onChange: (m: MemberBrief | null) => void }) {
  const [kw, setKw] = useState('')
  const [options, setOptions] = useState<MemberBrief[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchedRef = useRef(false)

  /** 拉取客户列表（keyword 为空时拉取最近 20 条作为下拉候选） */
  async function fetchMembers(keyword: string) {
    setSearching(true)
    try {
      const url = keyword
        ? `/api/admin/members?keyword=${encodeURIComponent(keyword)}&page=1`
        : `/api/admin/members?page=1`
      const res = await fetch(url)
      const json = await res.json()
      if (json.code === 0) setOptions(json.data.list.slice(0, 20))
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!open) return
    timer.current = setTimeout(() => {
      fetchMembers(kw)
    }, kw ? 300 : 0)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [kw, open])

  /** 点击外部关闭下拉 */
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2">
        <p className="text-sm text-ink">
          {memberName(value)}
          <span className="ml-2 text-xs text-slate-400">{value.phone || '无手机号'}</span>
        </p>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-slate-400 hover:text-red-600">
          重选
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="field"
        value={kw}
        onChange={(e) => {
          setKw(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="搜索客户 / 点击查看全部"
      />
      {open ? (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
          {searching ? (
            <p className="px-3 py-3 text-center text-xs text-slate-400">
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            </p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-400">{kw ? '无匹配客户' : '暂无客户，可先在「会员管理」新建'}</p>
          ) : (
            options.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-mist"
              >
                <span className="text-ink">{memberName(m)}</span>
                <span className="text-xs text-slate-400">
                  {m.userId ? `${m.userId} · ` : ''}
                  {m.phone || '无手机号'}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

/* ---------------- 月度运营报告 + 工作日报 ---------------- */

function ReportsDialog({ project, onClose, onChanged }: { project: Project; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'report' | 'daily'>('report')
  const [reports, setReports] = useState<Report[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Report | null>(null)
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [toast, setToast] = useState('')

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`)
      const json = await res.json()
      if (json.code === 0) {
        setReports(json.data.reports || [])
        setDailyLogs(json.data.dailyLogs || [])
      }
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    load()
  }, [load])

  async function remove(r: Report) {
    if (!window.confirm(`确认删除 ${r.month} 的报告？`)) return
    const res = await fetch(`/api/admin/projects/${project.id}/reports?reportId=${r.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.code !== 0) return notify(json.message || '删除失败')
    notify('报告已删除')
    await load()
    onChanged()
  }

  async function removeLog(d: DailyLog) {
    if (!window.confirm(`确认删除 ${d.workDate} 的日报？`)) return
    const res = await fetch(`/api/admin/projects/${project.id}/daily-logs?logId=${d.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.code !== 0) return notify(json.message || '删除失败')
    notify('日报已删除')
    await load()
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">运营进度 · {project.name}</h3>
            <p className="mt-0.5 text-xs text-slate-400">发布后客户在小程序「我的项目」中可查看（只读）</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 transition hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-lg bg-mist p-1">
          {[
            { key: 'report' as const, label: '月度报告', icon: BarChart3 },
            { key: 'daily' as const, label: '工作日报', icon: CalendarDays },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition',
                tab === t.key ? 'bg-white font-medium text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : tab === 'report' ? (
            reports.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">暂无报告，点击下方按钮发布第一份月报</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink">{r.month}</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(r)
                            setShowForm(true)
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 hover:border-brand-200 hover:text-brand-700"
                        >
                          <Pencil className="h-3 w-3" /> 编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 hover:border-red-200 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" /> 删除
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-7">
                      {[
                        { label: '视频', value: r.videos },
                        { label: '直播', value: r.lives },
                        { label: '播放量', value: r.views.toLocaleString() },
                        { label: '新粉丝', value: r.newFans.toLocaleString() },
                        { label: '咨询', value: r.leads },
                        { label: '成交', value: r.deals },
                        { label: 'GMV', value: `¥${yuan(r.gmv)}` },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg bg-mist px-1 py-2">
                          <p className="text-[11px] text-slate-400">{s.label}</p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-ink">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {r.summary ? <p className="mt-3 line-clamp-2 text-sm text-slate-600">总结：{r.summary}</p> : null}
                    {r.nextPlan ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">下月计划：{r.nextPlan}</p> : null}
                    {r.images?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.images.map((img, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={img} alt="" className="h-12 w-12 rounded-md object-cover" />
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : dailyLogs.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">暂无日报，点击下方按钮记录今日工作</p>
          ) : (
            <ul className="space-y-3">
              {dailyLogs.map((d) => (
                <li key={d.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink">{d.workDate}</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLog(d)
                          setShowLogForm(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 hover:border-brand-200 hover:text-brand-700"
                      >
                        <Pencil className="h-3 w-3" /> 编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLog(d)}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 hover:border-red-200 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" /> 删除
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{d.content}</p>
                  {(d.videos || d.lives || d.views || d.newFans || d.leads || d.deals || d.gmv) ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {d.videos ? <span>视频 {d.videos}</span> : null}
                      {d.lives ? <span>直播 {d.lives}</span> : null}
                      {d.views ? <span>播放 {d.views.toLocaleString()}</span> : null}
                      {d.newFans ? <span>新粉 {d.newFans.toLocaleString()}</span> : null}
                      {d.leads ? <span>咨询 {d.leads}</span> : null}
                      {d.deals ? <span>成交 {d.deals}</span> : null}
                      {d.gmv ? <span>GMV ¥{yuan(d.gmv)}</span> : null}
                    </div>
                  ) : null}
                  {d.summary ? <p className="mt-2 rounded-lg bg-brand-50/50 px-3 py-2 text-sm text-slate-600">总结：{d.summary}</p> : null}
                  {d.images?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.images.map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={img} alt="" className="h-12 w-12 rounded-md object-cover" />
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          {tab === 'report' ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> 发布月度报告
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingLog(null)
                setShowLogForm(true)
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> 记录今日工作
            </button>
          )}
        </div>
      </div>

      {showForm ? (
        <ReportFormDialog
          projectId={project.id}
          report={editing}
          onClose={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false)
            load()
            onChanged()
          }}
        />
      ) : null}
      {showLogForm ? (
        <DailyLogFormDialog
          projectId={project.id}
          log={editingLog}
          serviceType={project.serviceType}
          onClose={() => setShowLogForm(false)}
          onDone={() => {
            setShowLogForm(false)
            load()
            onChanged()
          }}
        />
      ) : null}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function DailyLogFormDialog({
  projectId,
  log,
  serviceType,
  onClose,
  onDone,
}: {
  projectId: number
  log: DailyLog | null
  serviceType?: { fieldsConfig: string | null } | null
  onClose: () => void
  onDone: () => void
}) {
  const [workDate, setWorkDate] = useState(log?.workDate || new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState(log?.content || '')
  const [videos, setVideos] = useState(String(log?.videos ?? 0))
  const [lives, setLives] = useState(String(log?.lives ?? 0))
  const [views, setViews] = useState(String(log?.views ?? 0))
  const [newFans, setNewFans] = useState(String(log?.newFans ?? 0))
  const [leads, setLeads] = useState(String(log?.leads ?? 0))
  const [deals, setDeals] = useState(String(log?.deals ?? 0))
  const [gmvYuan, setGmvYuan] = useState(log ? String(log.gmv / 100) : '0')
  const [summary, setSummary] = useState(log?.summary || '')
  const [images, setImages] = useState<string[]>(log?.images || [])
  // 服务类型自定义字段
  let dynFields: { name: string; type: string; unit?: string; required?: boolean; options?: string[] }[] = []
  try { dynFields = serviceType?.fieldsConfig ? JSON.parse(serviceType.fieldsConfig) : [] } catch {}
  const existingData = (() => { try { return log?.dataJson ? JSON.parse(log.dataJson) : {} } catch { return {} } })()
  const [dynValues, setDynValues] = useState<Record<string, string>>(existingData)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function num(v: string) {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return setError('日期格式应为 YYYY-MM-DD')
    if (!content.trim()) return setError('请填写工作内容')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/daily-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDate,
          content: content.trim(),
          videos: num(videos),
          lives: num(lives),
          views: num(views),
          newFans: num(newFans),
          leads: num(leads),
          deals: num(deals),
          gmv: Math.round(Number(gmvYuan || 0) * 100),
          summary: summary || '',
          images,
          dataJson: JSON.stringify(dynValues),
        }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || '保存失败')
      onDone()
    } catch {
      setError('网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{log ? `编辑 ${log.workDate} 日报` : '记录工作日报'}</h3>
          <button type="button" onClick={onClose} className="text-slate-300 transition hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label">工作日期 *</label>
            <input type="date" className="field" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">同一日期重复提交会覆盖旧内容</p>
          </div>
          <div>
            <label className="label">工作内容 *</label>
            <textarea
              className="field min-h-[120px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今天完成了哪些工作（选题、拍摄、剪辑、发布、数据等）"
              maxLength={10000}
            />
          </div>
          <div className="rounded-lg bg-mist/60 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">今日数据（用于月报自动汇总）</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">发布视频数</label>
                <input className="field" inputMode="numeric" value={videos} onChange={(e) => setVideos(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div>
                <label className="label">直播场次</label>
                <input className="field" inputMode="numeric" value={lives} onChange={(e) => setLives(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div>
                <label className="label">播放量</label>
                <input className="field" inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div>
                <label className="label">新增粉丝</label>
                <input className="field" inputMode="numeric" value={newFans} onChange={(e) => setNewFans(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div>
                <label className="label">咨询数</label>
                <input className="field" inputMode="numeric" value={leads} onChange={(e) => setLeads(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div>
                <label className="label">成交单数</label>
                <input className="field" inputMode="numeric" value={deals} onChange={(e) => setDeals(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div className="col-span-2">
                <label className="label">GMV（元）</label>
                <input className="field" inputMode="decimal" value={gmvYuan} onChange={(e) => setGmvYuan(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" />
              </div>
            </div>
          </div>
          {dynFields.length > 0 && (
            <div className="rounded-lg bg-brand-50/40 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">本服务类型专属字段</p>
              <div className="grid grid-cols-2 gap-3">
                {dynFields.map((f, i) => (
                  <div key={i} className={f.type === 'textarea' || f.type === 'image' ? 'col-span-2' : ''}>
                    <label className="label">{f.name}{f.required ? ' *' : ''}{f.unit ? `（${f.unit}）` : ''}</label>
                    {f.type === 'number' || f.type === 'percent' ? (
                      <input className="field" inputMode="numeric" value={dynValues[f.name] ?? ''}
                        onChange={(e) => setDynValues({ ...dynValues, [f.name]: e.target.value.replace(/[^\d.]/g, '') })} />
                    ) : f.type === 'textarea' ? (
                      <textarea className="field min-h-[60px]" value={dynValues[f.name] ?? ''}
                        onChange={(e) => setDynValues({ ...dynValues, [f.name]: e.target.value })} />
                    ) : (
                      <input className="field" value={dynValues[f.name] ?? ''}
                        onChange={(e) => setDynValues({ ...dynValues, [f.name]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">文字总结</label>
            <textarea className="field min-h-[64px]" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="一句话总结今天做了什么（可选）" maxLength={5000} />
          </div>
          <ImagesField label="工作截图" value={images} onChange={setImages} folder="projects" max={9} />
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
              取消
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReportFormDialog({
  projectId,
  report,
  onClose,
  onDone,
}: {
  projectId: number
  report: Report | null
  onClose: () => void
  onDone: () => void
}) {
  const [month, setMonth] = useState(report?.month || new Date().toISOString().slice(0, 7))
  // 数字字段由后端自动汇总当月日报，前端只读展示（预览用）
  const [agg, setAgg] = useState({
    videos: report?.videos ?? 0,
    lives: report?.lives ?? 0,
    views: report?.views ?? 0,
    newFans: report?.newFans ?? 0,
    leads: report?.leads ?? 0,
    deals: report?.deals ?? 0,
    gmv: report?.gmv ?? 0,
  })
  const [dailyCount, setDailyCount] = useState(0)
  const [summary, setSummary] = useState(report?.summary || '')
  const [nextPlan, setNextPlan] = useState(report?.nextPlan || '')
  const [images, setImages] = useState<string[]>(report?.images || [])
  const [submitting, setSubmitting] = useState(false)
  const [aiBusy, setAiBusy] = useState<'summary' | 'analyze' | ''>('')
  const [summaryNote, setSummaryNote] = useState('') // 「AI 生成总结」的状态提示
  const [analysis, setAnalysis] = useState('') // 「AI 分析」的正文
  const [error, setError] = useState('')

  // 切换月份时，从后端预取该月日报汇总（供只读预览）
  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/projects/${projectId}?month=${month}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || json.code !== 0) return
        const logs = (json.data.dailyLogs || []) as DailyLog[]
        const prefix = month
        const cur = logs.filter((l) => l.workDate.startsWith(prefix))
        setAgg({
          videos: cur.reduce((s, l) => s + (l.videos || 0), 0),
          lives: cur.reduce((s, l) => s + (l.lives || 0), 0),
          views: cur.reduce((s, l) => s + (l.views || 0), 0),
          newFans: cur.reduce((s, l) => s + (l.newFans || 0), 0),
          leads: cur.reduce((s, l) => s + (l.leads || 0), 0),
          deals: cur.reduce((s, l) => s + (l.deals || 0), 0),
          gmv: cur.reduce((s, l) => s + (l.gmv || 0), 0),
        })
        setDailyCount(cur.length)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [month, projectId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('月份格式应为 YYYY-MM')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          summary: summary || '',
          nextPlan: nextPlan || '',
          images,
        }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || '保存失败')
      onDone()
    } catch {
      setError('网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  /** AI 生成月报总结 */
  async function aiSummary() {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('请先选择月份')
    setAiBusy('summary')
    setError('')
    setSummaryNote('')
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/ai/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || 'AI 生成失败')
      setSummary(json.data.summary)
      setSummaryNote(`已生成（${json.data.model || ''}，${json.data.tokens || 0} token），可继续编辑`)
    } catch {
      setError('网络异常')
    } finally {
      setAiBusy('')
    }
  }

  /** AI 解析项目报表 */
  async function aiAnalyze() {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('请先选择月份')
    setAiBusy('analyze')
    setError('')
    setAnalysis('')
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || 'AI 分析失败')
      setAnalysis(json.data.analysis)
    } catch {
      setError('网络异常')
    } finally {
      setAiBusy('')
    }
  }

  const numFields = [
    { label: '发布视频', value: agg.videos },
    { label: '直播场次', value: agg.lives },
    { label: '播放量', value: agg.views.toLocaleString() },
    { label: '新增粉丝', value: agg.newFans.toLocaleString() },
    { label: '咨询数', value: agg.leads },
    { label: '成交数', value: agg.deals },
    { label: 'GMV（元）', value: yuan(agg.gmv) },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{report ? `编辑 ${report.month} 报告` : '发布月度报告'}</h3>
          <button type="button" onClick={onClose} className="text-slate-300 transition hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label">月份 *</label>
            <input type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">同一月份重复发布会覆盖旧数据</p>
          </div>

          {/* 自动汇总的数字卡片（只读） */}
          <div className="rounded-lg bg-mist/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">本月数据（自动汇总日报，无需手填）</p>
              <span className="text-[11px] text-slate-400">已汇总 {dailyCount} 天日报</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {numFields.map((f) => (
                <div key={f.label} className="rounded-md bg-white px-2 py-2 text-center">
                  <p className="text-[11px] text-slate-400">{f.label}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink">{f.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">修改任意一天日报后，保存月报时数字会自动重算</p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label">月度总结</label>
              <button
                type="button"
                onClick={aiSummary}
                disabled={aiBusy === 'summary'}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                {aiBusy === 'summary' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                ✨ AI 一键生成
              </button>
            </div>
            <textarea className="field min-h-[72px]" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="本月完成情况、亮点与问题（可点「AI 生成总结」自动撰写后编辑）" maxLength={5000} />
            {summaryNote && aiBusy === '' ? <p className="mt-1 text-xs text-green-600">{summaryNote}</p> : null}
          </div>

          <div className="flex items-center justify-between">
            <label className="label">AI 报表分析</label>
            <button
              type="button"
              onClick={aiAnalyze}
              disabled={aiBusy === 'analyze'}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-50"
            >
              {aiBusy === 'analyze' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LineChart className="h-3.5 w-3.5" />}
              AI 分析
            </button>
          </div>
          {analysis ? (
            <div className="whitespace-pre-wrap rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 text-sm text-slate-700">{analysis}</div>
          ) : null}

          <div>
            <label className="label">下月计划</label>
            <textarea className="field min-h-[72px]" value={nextPlan} onChange={(e) => setNextPlan(e.target.value)} placeholder="下月目标与执行安排" maxLength={5000} />
          </div>
          <ImagesField label="运营截图" value={images} onChange={setImages} folder="projects" max={9} />
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
              取消
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存发布
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
