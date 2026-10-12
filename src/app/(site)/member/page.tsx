import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentMember } from '@/lib/member-auth'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '会员中心 - 桃江闪途网络科技工作室（个体工商户）',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
  REFUNDED: 'bg-slate-100 text-slate-500',
}

const METHOD_LABEL: Record<string, string> = {
  WECHAT: '微信支付',
  ALIPAY: '支付宝',
  EPAY: '易支付',
  OFFLINE: '线下对接',
}

function yuan(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export default async function MemberPage() {
  const payload = await getCurrentMember()
  if (!payload) redirect('/login?redirect=/member')

  const member = await prisma.member.findUnique({ where: { id: payload.id } })
  if (!member) redirect('/login?redirect=/member')

  const orders = await prisma.order.findMany({
    where: { memberId: member.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const paidTotal = orders.filter((o) => o.status === 'PAID').reduce((s, o) => s + o.amount, 0)

  const projects = await prisma.project.findMany({
    where: { memberId: member.id },
    include: { reports: { orderBy: { month: 'desc' } }, serviceType: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <section className="bg-mist py-14 sm:py-16">
      <div className="container-page max-w-4xl">
        <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
                闪途
              </span>
              <div>
                <h1 className="text-lg font-semibold text-ink">
                  {member.name || member.nickname || '会员'}
                </h1>
                <p className="text-xs text-slate-400">
                  {member.type === 'MINI' ? '微信小程序会员' : '官网会员'} · 注册于{' '}
                  {formatDate(member.createdAt)}
                </p>
              </div>
            </div>
            {member.userId ? (
              <div className="rounded-xl bg-brand-50 px-4 py-2.5 text-center">
                <p className="text-[11px] text-brand-700/70">会员ID（可用于登录）</p>
                <p className="text-base font-semibold tracking-wide text-brand-700">{member.userId}</p>
              </div>
            ) : null}
          </div>

          <dl className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-400">手机号</dt>
              <dd className="mt-1 text-sm text-ink">{member.phone || '未绑定'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">订单总数</dt>
              <dd className="mt-1 text-sm text-ink">{orders.length} 单</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">已支付金额</dt>
              <dd className="mt-1 text-sm text-ink">¥{yuan(paidTotal)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="text-sm font-semibold text-ink">我的订单</h2>
            <Link href="/pricing" className="text-sm text-brand-600 hover:text-brand-700">
              继续购买套餐 →
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-400">
              还没有订单，去
              <Link href="/pricing" className="mx-1 text-brand-600 hover:text-brand-700">
                套餐价格
              </Link>
              看看吧
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{o.packageName}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      订单号 {o.orderNo} · {formatDate(o.createdAt, true)}
                      {o.payMethod ? ` · ${METHOD_LABEL[o.payMethod] || o.payMethod}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-ink">¥{yuan(o.amount)}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        STATUS_CLASS[o.status] || 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                    {o.status === 'PENDING' ? (
                      <Link
                        href={`/pay/${o.orderNo}?tail=${o.phone.slice(-4)}`}
                        className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs text-brand-700 transition hover:bg-brand-50"
                      >
                        去支付
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {projects.length ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-sm font-semibold text-ink">服务进度</h2>
            </div>
            {projects.map((pr) => {
              const latest = pr.reports[0]
              return (
                <div key={pr.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{pr.name}</p>
                    {pr.manager ? <span className="text-xs text-slate-400">负责人：{pr.manager}</span> : null}
                  </div>
                  {latest ? (() => {
                    // 按服务类型动态渲染卡片
                    let fields: { name: string; type: string; unit?: string }[] = []
                    try { fields = pr.serviceType?.fieldsConfig ? JSON.parse(pr.serviceType.fieldsConfig) : [] } catch {}
                    let dyn: Record<string, number | string> = {}
                    try { dyn = latest.dataJson ? JSON.parse(latest.dataJson) : {} } catch {}
                    if (fields.length) {
                      const nums = fields.filter((f) => f.type === 'number' || f.type === 'percent')
                      return (
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {nums.map((f) => (
                            <div key={f.name}>
                              <p className="text-base font-semibold text-ink">
                                {dyn[f.name] ?? 0}{f.unit ? <span className="ml-0.5 text-xs font-normal text-slate-400">{f.unit}</span> : null}
                              </p>
                              <p className="text-[11px] text-slate-400">{f.name}</p>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    // 老项目：固定6卡片
                    return (
                      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                        <div><p className="text-base font-semibold text-ink">{latest.videos}</p><p className="text-[11px] text-slate-400">发布视频</p></div>
                        <div><p className="text-base font-semibold text-ink">{Number(latest.views).toLocaleString()}</p><p className="text-[11px] text-slate-400">播放量</p></div>
                        <div><p className="text-base font-semibold text-ink">{latest.leads}</p><p className="text-[11px] text-slate-400">新增咨询</p></div>
                        <div><p className="text-base font-semibold text-ink">{Number(latest.newFans).toLocaleString()}</p><p className="text-[11px] text-slate-400">新增粉丝</p></div>
                        <div><p className="text-base font-semibold text-ink">{latest.lives}</p><p className="text-[11px] text-slate-400">直播场次</p></div>
                        <div><p className="text-base font-semibold text-ink">{latest.deals}</p><p className="text-[11px] text-slate-400">成交</p></div>
                      </div>
                    )
                  })() : null}
                  {latest?.nextPlan ? (
                    <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                      <span className="font-medium">下月计划：</span>
                      {latest.nextPlan}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}
