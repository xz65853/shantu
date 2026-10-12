import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { formatDate, parseJsonArray } from '@/lib/utils'
import { LeadStatusBadge } from '@/components/admin/lead-status'
import { FollowupPanel, LeadStatusForm, type FollowupItem } from '@/components/admin/lead-actions'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('leads')
  const { id } = await params
  const leadId = Number(id)
  if (!Number.isFinite(leadId)) notFound()

  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } })
  if (!lead) notFound()

  const [followups, admins] = await Promise.all([
    prisma.leadFollowup.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { displayName: true } } },
    }),
    prisma.admin.findMany({ where: { isActive: true }, select: { id: true, displayName: true } }),
  ])

  const items: FollowupItem[] = followups.map((f) => ({
    id: f.id,
    content: f.content,
    author: f.admin?.displayName || null,
    nextFollowupAt: f.nextFollowupAt ? f.nextFollowupAt.toISOString() : null,
    createdAt: f.createdAt.toISOString(),
  }))

  const owner = lead.assignedTo
    ? await prisma.admin.findUnique({ where: { id: lead.assignedTo }, select: { displayName: true } })
    : null

  const info = [
    { label: '姓名', value: lead.name },
    { label: '手机号', value: lead.phone },
    { label: '公司', value: lead.company || '-' },
    { label: '城市', value: lead.city || '-' },
    { label: '行业', value: lead.industry || '-' },
    { label: '需求', value: parseJsonArray(lead.requirements).join(' · ') || '-' },
    { label: '来源页面', value: lead.sourcePage || lead.source || '-' },
    { label: '当前负责人', value: owner?.displayName || '未分配' },
    { label: '提交时间', value: formatDate(lead.createdAt, true) },
    { label: '最后更新', value: formatDate(lead.updatedAt, true) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回客户列表
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{lead.name}</h1>
          <LeadStatusBadge status={lead.status} />
          <span className="text-sm text-slate-400">{lead.phone}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">客户信息</h2>
            </div>
            <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              {info.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-slate-400">{item.label}</dt>
                  <dd className="mt-1 text-sm text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            {lead.message ? (
              <div className="border-t border-line p-5">
                <div className="text-xs text-slate-400">客户描述的问题</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {lead.message}
                </p>
              </div>
            ) : null}
          </div>

          <FollowupPanel leadId={lead.id} items={items} />
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">状态与分配</h2>
          <LeadStatusForm
            leadId={lead.id}
            status={lead.status}
            assignedTo={lead.assignedTo}
            admins={admins.map((a) => ({ id: a.id, name: a.displayName }))}
          />
        </div>
      </div>
    </div>
  )
}
