import { cn } from '@/lib/utils'

export const LEAD_STATUS_LABEL: Record<string, string> = {
  PENDING: '待联系',
  CONTACTED: '已联系',
  INTENTION: '意向客户',
  QUOTED: '已报价',
  WON: '已成交',
  HOLD: '暂不考虑',
  INVALID: '无效',
}

const STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONTACTED: 'bg-blue-50 text-blue-700 border-blue-200',
  INTENTION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  QUOTED: 'bg-violet-50 text-violet-700 border-violet-200',
  WON: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HOLD: 'bg-slate-100 text-slate-600 border-slate-200',
  INVALID: 'bg-red-50 text-red-600 border-red-200',
}

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        STYLE[status] || STYLE.PENDING,
      )}
    >
      {LEAD_STATUS_LABEL[status] || status}
    </span>
  )
}
