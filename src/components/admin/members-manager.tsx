'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2,
  Plus,
  Receipt,
  Search,
  ShieldOff,
  ShieldCheck,
  KeyRound,
  Merge,
  Trash2,
  X,
  Eye,
  User,
  BadgeCheck,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { DeleteDialog } from './delete-dialog'
import { WatermarkOverlay } from '@/components/watermark-overlay'

type Member = {
  id: number
  userId: string | null
  type: 'WEB' | 'MINI'
  phone: string | null
  name: string | null
  nickname: string | null
  avatar: string | null
  status: string
  remark: string | null
  hasPassword: boolean
  source: string
  isRealVerified?: boolean
  realName?: string | null
  orderCount: number
  mergedCount: number
  lastLoginAt: string | null
  createdAt: string
  isCancelled?: boolean
}

type MemberDetail = {
  isRealVerified: boolean
  realName: string | null
  idCardMasked: string
  realVerifiedAt: string | null
  canViewIdCardPlain?: boolean
}

type RealNameAuth = {
  id: number
  realName: string
  idCardMasked: string
  status: string
  verifyChannel: string
  transactionId: string | null
  failReason: string | null
  verifiedAt: string | null
  createdAt: string
}

type Order = {
  id: number
  orderNo: string
  packageName: string
  amount: number
  status: string
  payMethod: string | null
  createdAt: string
}

type Stats = { webCount: number; miniCount: number; withPhone: number; todayNew: number }

const TYPE_LABEL: Record<string, string> = { WEB: '官网', MINI: '小程序' }
const STATUS_LABEL: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}
const METHOD_LABEL: Record<string, string> = {
  WECHAT: '微信',
  ALIPAY: '支付宝',
  EPAY: '易支付',
  OFFLINE: '线下',
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** 头像 URL 规范化：只认 http(s) 完整地址，临时路径/相对路径视为无头像 */
function resolveAvatar(url: string | null | undefined): string {
  if (!url) return ''
  return /^https?:\/\//.test(url) ? url : ''
}

const CHANNEL_LABEL: Record<string, string> = { wechat_face: '微信人脸核身', manual_idcard: '二要素核验' }
const AUTH_STATUS_LABEL: Record<string, string> = { PENDING: '待核验', VERIFIED: '已认证', FAILED: '未通过' }

/** 头像：无头像 → 灰色人像图标；有头像 → 点击放大（灯箱）；可选小蓝勾（已认证） */
function Avatar({
  src,
  name,
  size = 32,
  verified = false,
}: {
  src: string | null
  name: string
  size?: number
  verified?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const [zoom, setZoom] = useState(false)
  const url = resolveAvatar(src)
  const dim = { width: size, height: size }

  // 无头像或加载失败：灰色人像图标
  if (!url || broken) {
    return (
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200"
        style={dim}
        title={name}
      >
        <User className="text-slate-400" style={{ width: size * 0.55, height: size * 0.55 }} />
        {verified ? (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-px">
            <BadgeCheck className="text-blue-500" style={{ width: size * 0.42, height: size * 0.42 }} />
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="relative inline-flex shrink-0 cursor-zoom-in"
        style={dim}
        title={`${name}（点击放大）`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full object-cover"
        />
        {verified ? (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-px">
            <BadgeCheck className="text-blue-500" style={{ width: size * 0.42, height: size * 0.42 }} />
          </span>
        ) : null}
      </button>

      {zoom ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setZoom(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={name}
              className="max-h-[75vh] max-w-[75vw] rounded-xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoom(false)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow hover:text-ink"
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function MembersManager() {
  const [list, setList] = useState<Member[]>([])
  const [stats, setStats] = useState<Stats>({ webCount: 0, miniCount: 0, withPhone: 0, todayNew: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(0)

  // 弹层
  const [showCreate, setShowCreate] = useState(false)
  const [resetMember, setResetMember] = useState<Member | null>(null)
  const [mergeMember, setMergeMember] = useState<Member | null>(null)
  const [delTarget, setDelTarget] = useState<Member | null>(null)
  const [ordersMember, setOrdersMember] = useState<Member | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null)
  const [realNameAuths, setRealNameAuths] = useState<RealNameAuth[]>([])
  const [toast, setToast] = useState('')

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (type) params.set('type', type)
      if (query) params.set('keyword', query)
      const res = await fetch(`/api/admin/members?${params}`)
      const json = await res.json()
      if (json.code === 0) {
        setList(json.data.list)
        setStats(json.data.stats)
        setTotal(json.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, type, query])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id: number, body: Record<string, unknown>, msg: string) {
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.code !== 0) {
        notify(json.message || '操作失败')
        return false
      }
      if (msg) notify(msg)
      await load()
      return true
    } finally {
      setSavingId(0)
    }
  }

  async function openOrders(m: Member) {
    setOrdersMember(m)
    setOrdersLoading(true)
    setOrders([])
    setMemberDetail(null)
    setRealNameAuths([])
    try {
      const res = await fetch(`/api/admin/members/${m.id}`)
      const json = await res.json()
      if (json.code === 0) {
        setOrders(json.data.orders || [])
        setMemberDetail(json.data.member || null)
        setRealNameAuths(json.data.realNameAuths || [])
      }
    } finally {
      setOrdersLoading(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-4">
      {/* 统计卡 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '官网会员', value: stats.webCount },
          { label: '小程序会员', value: stats.miniCount },
          { label: '已留手机号', value: stats.withPhone },
          { label: '今日新增', value: stats.todayNew },
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
          { v: 'WEB', label: '官网会员' },
          { v: 'MINI', label: '小程序会员' },
        ].map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => {
              setType(t.v)
              setPage(1)
            }}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm transition',
              type === t.v ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:border-brand-200',
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm text-white transition hover:bg-brand-700"
        >
          <Plus className="h-3.5 w-3.5" /> 新建会员
        </button>
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(keyword)
            setPage(1)
          }}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              className="field w-56 pl-8"
              placeholder="搜索会员ID / 手机号 / 昵称"
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
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">会员</th>
              <th className="px-4 py-3 font-medium">来源</th>
              <th className="px-4 py-3 font-medium">订单</th>
              <th className="px-4 py-3 font-medium">实名认证</th>
              <th className="px-4 py-3 font-medium">最近登录</th>
              <th className="px-4 py-3 font-medium">注册时间</th>
              <th className="px-4 py-3 font-medium">备注</th>
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
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                  暂无会员。可点击「新建会员」开户，或由官网注册 / 小程序微信登录自动创建。
                </td>
              </tr>
            ) : (
              list.map((m) => (
                <tr key={m.id} className="transition hover:bg-mist/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={m.avatar} name={m.name || m.nickname || m.phone || ''} verified={Boolean(m.isRealVerified)} />
                      <div>
                        <p className="font-medium text-ink">
                          {m.isCancelled ? <span className="mr-1.5 text-slate-400">[已注销]</span> : null}
                          {m.name || m.nickname || '未命名'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {m.userId ? <span className="text-brand-700">{m.userId}</span> : null}
                          {m.userId && m.phone ? ' · ' : null}
                          {m.phone || '未绑定手机号'}
                        </p>
                        {m.mergedCount > 0 ? (
                          <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                            已合并 {m.mergedCount} 个账号
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        m.type === 'MINI' ? 'bg-green-50 text-green-700' : 'bg-brand-50 text-brand-700',
                      )}
                    >
                      {TYPE_LABEL[m.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openOrders(m)}
                      className="inline-flex items-center gap-1 text-slate-600 transition hover:text-brand-700"
                      title="查看该会员订单"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      {m.orderCount}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {m.isRealVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> 已认证
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                        未认证
                      </span>
                    )}
                    {m.realName ? <p className="mt-0.5 text-[11px] text-slate-400">{m.realName}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {m.lastLoginAt ? formatDate(m.lastLoginAt, true) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(m.createdAt, true)}</td>
                  <td className="px-4 py-3">
                    <input
                      className="field w-36 text-xs disabled:opacity-50"
                      defaultValue={m.remark || ''}
                      placeholder="添加备注"
                      disabled={m.isCancelled}
                      onBlur={(e) => {
                        if (e.target.value !== (m.remark || '')) patch(m.id, { remark: e.target.value }, '备注已保存')
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {m.isCancelled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
                        <ShieldOff className="h-3.5 w-3.5" />
                        已注销
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          patch(
                            m.id,
                            { status: m.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' },
                            m.status === 'ACTIVE' ? '已禁用该会员' : '已恢复该会员',
                          )
                        }
                        disabled={savingId === m.id}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition',
                          m.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-red-50 text-red-600 hover:bg-red-100',
                        )}
                      >
                        {m.status === 'ACTIVE' ? (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldOff className="h-3.5 w-3.5" />
                        )}
                        {m.status === 'ACTIVE' ? '正常' : '已禁用'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setResetMember(m)}
                        disabled={m.isCancelled}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-line disabled:hover:text-slate-600"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        {m.hasPassword ? '重置密码' : '设置密码'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMergeMember(m)}
                        disabled={m.isCancelled}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-line disabled:hover:text-slate-600"
                        title="合并其他账号到该会员"
                      >
                        <Merge className="h-3.5 w-3.5" />
                        合并
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelTarget(m)}
                        disabled={m.isCancelled}
                        className="inline-flex items-center gap-1 rounded-full border border-line p-1.5 text-slate-400 transition hover:border-red-200 hover:text-red-600 disabled:opacity-40 disabled:hover:border-line disabled:hover:text-slate-400"
                        title="删除该会员"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((v) => v - 1)}
          >
            上一页
          </button>
          <span className="text-slate-400">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
            disabled={page >= pageCount}
            onClick={() => setPage((v) => v + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}

      {showCreate ? <CreateDialog onClose={() => setShowCreate(false)} onDone={load} /> : null}
      {resetMember ? (
        <ResetDialog member={resetMember} onClose={() => setResetMember(null)} onDone={load} />
      ) : null}
      {mergeMember ? (
        <MergeDialog member={mergeMember} onClose={() => setMergeMember(null)} onDone={load} />
      ) : null}
      {delTarget ? (
        <DeleteDialog
          type="member"
          id={delTarget.id}
          info={`${delTarget.name || delTarget.nickname || '未命名'}（${delTarget.phone || '无手机号'}）`}
          onClose={() => setDelTarget(null)}
          onDone={load}
        />
      ) : null}
      {ordersMember ? (
        <OrdersDialog
          member={ordersMember}
          orders={orders}
          loading={ordersLoading}
          detail={memberDetail}
          realNameAuths={realNameAuths}
          onClose={() => setOrdersMember(null)}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-300 transition hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState<'WEB' | 'MINI'>('WEB')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^1[3-9]\d{9}$/.test(phone)) return setError('请输入正确的 11 位手机号')
    if (password.length < 6) return setError('密码至少 6 位')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name: name || undefined, password, type, remark: remark || undefined }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || '创建失败')
      onDone()
      onClose()
    } catch {
      setError('网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title="新建会员" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">手机号 *</label>
          <input
            className="field"
            inputMode="numeric"
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="11 位手机号"
          />
        </div>
        <div>
          <label className="label">姓名 / 称呼</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="选填" />
        </div>
        <div>
          <label className="label">初始密码 *</label>
          <input
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位，创建后可重置"
          />
        </div>
        <div>
          <label className="label">会员来源</label>
          <div className="flex gap-2">
            {(['WEB', 'MINI'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm transition',
                  type === t ? 'bg-ink text-white' : 'border border-line text-slate-600',
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">备注</label>
          <input className="field" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="选填" />
        </div>
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
            取消
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            创建
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function ResetDialog({ member, onClose, onDone }: { member: Member; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setError('密码至少 6 位')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || '重置失败')
      onDone()
      onClose()
    } catch {
      setError('网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title={member.hasPassword ? '重置登录密码' : '设置登录密码'} onClose={onClose}>
      <p className="text-sm text-slate-500">
        会员：{member.name || member.nickname || '未命名'}
        {member.userId ? `（${member.userId}）` : ''}
        {member.phone ? ` · ${member.phone}` : ''}
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div>
          <label className="label">新密码 *</label>
          <input
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
          />
          <p className="mt-1 text-xs text-slate-400">
            设置后立即生效，会员可用「手机号或会员ID + 新密码」登录
          </p>
        </div>
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
            取消
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function OrdersDialog({
  member,
  orders,
  loading,
  detail,
  realNameAuths,
  onClose,
}: {
  member: Member
  orders: Order[]
  loading: boolean
  detail: MemberDetail | null
  realNameAuths: RealNameAuth[]
  onClose: () => void
}) {
  // 明文身份证查看状态
  const [plain, setPlain] = useState<{ realName: string; idCard: string } | null>(null)
  const [realWmOn, setRealWmOn] = useState(false)
  const [realWmText, setRealWmText] = useState('仅供核对')
  const [confirming, setConfirming] = useState(false)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    fetch('/api/admin/watermark')
      .then((r) => r.json())
      .then((j) => {
        if (j?.code === 0 && j?.data) {
          if (j.data.realname_wm_enable !== '0') setRealWmOn(true)
          if (j.data.realname_wm_text) setRealWmText(j.data.realname_wm_text)
        }
      })
      .catch(() => {})
  }, [])

  // 明文 5 秒后自动切回脱敏
  useEffect(() => {
    if (!plain) return
    const t = setTimeout(() => setPlain(null), 5000)
    return () => clearTimeout(t)
  }, [plain])

  async function viewIdCard() {
    if (!detail?.canViewIdCardPlain) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/admin/members/${member.id}/idcard-plain`)
      const json = await res.json()
      if (json.code !== 0) {
        alert(json.message || '无权查看')
        return
      }
      setPlain({ realName: json.data.realName || '', idCard: json.data.idCard || '' })
    } catch {
      alert('网络异常')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {plain && realWmOn ? (
        <WatermarkOverlay text={realWmText} color="#c0c0c0" opacity={0.15} fontSize={13} zIndex={60} />
      ) : null}
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              src={member.avatar}
              name={member.name || member.nickname || ''}
              size={80}
              verified={Boolean(detail?.isRealVerified)}
            />
            <div>
              <h3 className="text-base font-semibold text-ink">
                {member.name || member.nickname || '未命名'} 的详情
              </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {member.userId ? `${member.userId} · ` : ''}
              {member.phone || '未绑定手机号'} · 共 {member.orderCount} 单
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 transition hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 实名认证信息（只读） */}
        <div className="mt-4 rounded-xl border border-line bg-mist/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">实名认证</p>
            {detail?.isRealVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                <ShieldCheck className="h-3.5 w-3.5" /> 已认证
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">未认证</span>
            )}
          </div>
          {detail?.isRealVerified ? (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <p className="text-slate-500">
                姓名：<span className="text-ink">{plain?.realName || detail.realName || '—'}</span>
              </p>
              <p className="text-slate-500">
                认证时间：<span className="text-ink">{detail.realVerifiedAt ? formatDate(detail.realVerifiedAt, true) : '—'}</span>
              </p>
              <p className="col-span-2 text-slate-500">
                身份证号：
                <span className="text-ink">{plain?.idCard || detail.idCardMasked || '—'}</span>
                {detail.canViewIdCardPlain ? (
                  plain ? (
                    <span className="ml-2 text-xs text-slate-400">（5 秒后自动隐藏）</span>
                  ) : (
                    <button
                      type="button"
                      disabled={confirming}
                      onClick={() => {
                        if (window.confirm('查看明文身份证将记录操作日志，确认查看？')) {
                          viewIdCard()
                        }
                      }}
                      className="ml-2 inline-flex items-center gap-0.5 rounded border border-line px-1.5 py-0.5 text-xs text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
                    >
                      {confirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                      查看明文
                    </button>
                  )
                ) : null}
              </p>
            </div>
          ) : null}
          {realNameAuths.length > 0 ? (
            <div className="mt-3 border-t border-line pt-2">
              <p className="text-xs font-medium text-slate-400">核身记录（只读，可对账）</p>
              <ul className="mt-1 space-y-1">
                {realNameAuths.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>{formatDate(a.createdAt, true)}</span>
                    <span className="text-ink">{a.realName}</span>
                    <span>{a.idCardMasked}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5',
                        a.status === 'VERIFIED'
                          ? 'bg-green-50 text-green-700'
                          : a.status === 'FAILED'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-700',
                      )}
                    >
                      {AUTH_STATUS_LABEL[a.status] || a.status}
                    </span>
                    <span>{CHANNEL_LABEL[a.verifyChannel] || a.verifyChannel}</span>
                    {a.transactionId ? <span className="text-slate-400" title="核身流水号">流水号：{a.transactionId}</span> : null}
                    {a.failReason ? <span className="text-red-500">{a.failReason}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-4 max-h-[46vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">该会员暂无订单</p>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{o.packageName}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {o.orderNo} · {formatDate(o.createdAt, true)}
                      {o.payMethod ? ` · ${METHOD_LABEL[o.payMethod] || o.payMethod}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">¥{yuan(o.amount)}</span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs',
                        o.status === 'PAID'
                          ? 'bg-green-50 text-green-700'
                          : o.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function MergeDialog({ member, onClose, onDone }: { member: Member; onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!/^1[3-9]\d{9}$/.test(phone)) return setError('请输入正确的 11 位手机号')
    if (confirmText !== '合并') return setError('请输入「合并」以确认')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/members/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: member.id, sourcePhone: phone }),
      })
      const json = await res.json()
      if (json.code !== 0) return setError(json.message || '合并失败')
      onDone()
      onClose()
    } catch {
      setError('网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title="合并会员" onClose={onClose}>
      <p className="text-sm text-slate-500">
        目标会员：{member.name || member.nickname || '未命名'}
        {member.userId ? `（${member.userId}）` : ''}
        {member.phone ? ` · ${member.phone}` : ''}
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="label">要合并进来的手机号 *</label>
          <input
            className="field"
            inputMode="numeric"
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="11 位手机号"
          />
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          合并后，该手机号账号的订单 / 项目会迁入当前会员，被合并账号不再单独显示，且会写入合并日志。
        </div>
        <div>
          <label className="label">输入「合并」确认 *</label>
          <input className="field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="合并" />
        </div>
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认合并
          </button>
        </div>
      </div>
    </Dialog>
  )
}
