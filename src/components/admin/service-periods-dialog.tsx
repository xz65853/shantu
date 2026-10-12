'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, ListTodo, Loader2, Plus, Trash2, X } from 'lucide-react'

type Period = {
  id: number
  packageName: string | null
  periodDays: number
  startAt: string
  endAt: string
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  orderId: number | null
  prevPeriodId: number | null
  _count?: { tasks: number }
}

type Task = {
  id: number
  title: string
  description: string | null
  assigneeId: number | null
  dueAt: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'CANCELLED'
  sort: number
}

const PERIOD_STATUS: Record<Period['status'], { label: string; cls: string }> = {
  PENDING: { label: '待开始', cls: 'bg-slate-100 text-slate-600' },
  ACTIVE: { label: '进行中', cls: 'bg-brand-50 text-brand-700' },
  PAUSED: { label: '暂停', cls: 'bg-amber-50 text-amber-700' },
  COMPLETED: { label: '已完成', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: '已取消', cls: 'bg-red-50 text-red-600' },
}

const TASK_STATUS: Record<Task['status'], { label: string; cls: string }> = {
  TODO: { label: '待办', cls: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: '进行中', cls: 'bg-brand-50 text-brand-700' },
  COMPLETED: { label: '已完成', cls: 'bg-emerald-50 text-emerald-700' },
  DELAYED: { label: '延期', cls: 'bg-amber-50 text-amber-700' },
  CANCELLED: { label: '已取消', cls: 'bg-red-50 text-red-600' },
}

function fmt(d: string) {
  if (!d) return '—'
  const s = String(d).slice(0, 10)
  return s
}

export function ServicePeriodsDialog({
  project,
  onClose,
  onChanged,
}: {
  project: { id: number; name: string }
  onClose: () => void
  onChanged?: () => void
}) {
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Record<number, Task[]>>({})
  const [tasksLoading, setTasksLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  // 新增周期表单
  const [showAddPeriod, setShowAddPeriod] = useState(false)
  const [npDays, setNpDays] = useState(31)
  const [npStart, setNpStart] = useState('')
  const [npEnd, setNpEnd] = useState('')

  // 新增任务表单
  const [taskFor, setTaskFor] = useState<number | null>(null)
  const [ntTitle, setNtTitle] = useState('')
  const [ntDue, setNtDue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/service-periods`)
      const data = await res.json()
      if (data.code === 0) setPeriods(data.data.periods)
    } catch {
      setToast('加载失败')
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    load()
  }, [load])

  async function toggleTasks(periodId: number) {
    if (expanded === periodId) {
      setExpanded(null)
      return
    }
    setExpanded(periodId)
    if (!tasks[periodId]) {
      setTasksLoading(true)
      try {
        const res = await fetch(`/api/admin/service-periods/${periodId}/tasks`)
        const data = await res.json()
        if (data.code === 0) setTasks((prev) => ({ ...prev, [periodId]: data.data.tasks }))
      } catch {
        setToast('加载任务失败')
      } finally {
        setTasksLoading(false)
      }
    }
  }

  async function addPeriod() {
    if (!npStart || !npEnd) {
      setToast('请填写起止日期')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/service-periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodDays: npDays, startAt: npStart, endAt: npEnd }),
      })
      const data = await res.json()
      if (data.code === 0) {
        setShowAddPeriod(false)
        setNpDays(31)
        setNpStart('')
        setNpEnd('')
        await load()
        onChanged?.()
      } else {
        setToast(data.message || '创建失败')
      }
    } catch {
      setToast('创建失败')
    } finally {
      setBusy(false)
    }
  }

  async function addTask(periodId: number) {
    if (!ntTitle.trim()) {
      setToast('请填写任务标题')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/service-periods/${periodId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ntTitle.trim(), dueAt: ntDue || null }),
      })
      const data = await res.json()
      if (data.code === 0) {
        setTaskFor(null)
        setNtTitle('')
        setNtDue('')
        const res2 = await fetch(`/api/admin/service-periods/${periodId}/tasks`)
        const data2 = await res2.json()
        if (data2.success) setTasks((prev) => ({ ...prev, [periodId]: data2.data.tasks }))
        await load()
      } else {
        setToast(data.message || '创建失败')
      }
    } catch {
      setToast('创建失败')
    } finally {
      setBusy(false)
    }
  }

  async function changeTaskStatus(periodId: number, taskId: number, status: Task['status']) {
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.code === 0) {
        setTasks((prev) => ({ ...prev, [periodId]: (prev[periodId] || []).map((t) => (t.id === taskId ? { ...t, status } : t)) }))
      }
    } catch {
      setToast('更新失败')
    }
  }

  async function removeTask(periodId: number, taskId: number) {
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.code === 0) {
        setTasks((prev) => ({ ...prev, [periodId]: (prev[periodId] || []).filter((t) => t.id !== taskId) }))
        await load()
      }
    } catch {
      setToast('删除失败')
    }
  }

  async function changePeriodStatus(periodId: number, status: Period['status']) {
    try {
      const res = await fetch(`/api/admin/service-periods/${periodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.code === 0) {
        setPeriods((prev) => prev.map((p) => (p.id === periodId ? { ...p, status } : p)))
        onChanged?.()
      }
    } catch {
      setToast('更新失败')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink">服务周期与任务</h3>
            <p className="mt-0.5 text-xs text-slate-400">{project.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddPeriod(true)}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-3 py-1.5 text-xs text-brand-700 transition hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" /> 续费周期
            </button>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition hover:bg-mist hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {toast ? (
            <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{toast}</div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : periods.length === 0 ? (
            <div className="py-16 text-center text-slate-400">暂无服务周期，点击「续费周期」创建。</div>
          ) : (
            <div className="space-y-3">
              {periods.map((p) => (
                <div key={p.id} className="rounded-xl border border-line">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleTasks(p.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {expanded === p.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-ink">
                        {fmt(p.startAt)} ~ {fmt(p.endAt)}
                      </span>
                      <span className="text-xs text-slate-400">{p.periodDays} 天</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${PERIOD_STATUS[p.status].cls}`}>
                        {PERIOD_STATUS[p.status].label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <ListTodo className="h-3.5 w-3.5" /> {p._count?.tasks ?? 0}
                      </span>
                    </button>
                    <select
                      className="rounded-full border border-line px-2 py-1 text-xs outline-none"
                      value={p.status}
                      onChange={(e) => changePeriodStatus(p.id, e.target.value as Period['status'])}
                    >
                      {Object.keys(PERIOD_STATUS).map((s) => (
                        <option key={s} value={s}>
                          {PERIOD_STATUS[s as Period['status']].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {expanded === p.id ? (
                    <div className="border-t border-line px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">任务</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTaskFor(p.id)
                            setNtTitle('')
                            setNtDue('')
                          }}
                          className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" /> 添加任务
                        </button>
                      </div>

                      {taskFor === p.id ? (
                        <div className="mb-3 flex items-center gap-2 rounded-lg bg-mist p-2">
                          <input
                            className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-300"
                            placeholder="任务标题"
                            value={ntTitle}
                            onChange={(e) => setNtTitle(e.target.value)}
                          />
                          <input
                            type="date"
                            className="rounded-md border border-line px-2 py-1.5 text-sm outline-none"
                            value={ntDue}
                            onChange={(e) => setNtDue(e.target.value)}
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => addTask(p.id)}
                            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button type="button" onClick={() => setTaskFor(null)} className="text-xs text-slate-400 hover:text-slate-600">
                            取消
                          </button>
                        </div>
                      ) : null}

                      {tasksLoading ? (
                        <div className="py-4 text-center text-slate-400">
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        </div>
                      ) : !tasks[p.id] || tasks[p.id].length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400">暂无任务</div>
                      ) : (
                        <ul className="space-y-1.5">
                          {(tasks[p.id] || []).map((t) => (
                            <li key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-mist/60">
                              <span className="flex-1 text-sm text-ink">{t.title}</span>
                              {t.dueAt ? <span className="text-xs text-slate-400">截止 {fmt(t.dueAt)}</span> : null}
                              <select
                                className={`rounded-full px-2 py-0.5 text-xs outline-none ${TASK_STATUS[t.status].cls}`}
                                value={t.status}
                                onChange={(e) => changeTaskStatus(p.id, t.id, e.target.value as Task['status'])}
                              >
                                {Object.keys(TASK_STATUS).map((s) => (
                                  <option key={s} value={s}>
                                    {TASK_STATUS[s as Task['status']].label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeTask(p.id, t.id)}
                                className="text-slate-300 transition hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddPeriod ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-ink">新增服务周期（续费）</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-600">
                服务天数
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                  value={npDays}
                  onChange={(e) => setNpDays(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm text-slate-600">
                开始日期
                <input type="date" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none" value={npStart} onChange={(e) => setNpStart(e.target.value)} />
              </label>
              <label className="block text-sm text-slate-600">
                结束日期
                <input type="date" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none" value={npEnd} onChange={(e) => setNpEnd(e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddPeriod(false)} className="rounded-full border border-line px-4 py-2 text-sm text-slate-600 hover:bg-mist">
                取消
              </button>
              <button type="button" disabled={busy} onClick={addPeriod} className="rounded-full bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
                创建
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
