'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export type CaseRow = {
  id: number
  title: string
  slug: string
  industry: string | null
  status: string
  isFeatured: boolean
  sort: number
  categoryName: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下架',
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OFFLINE: 'bg-amber-50 text-amber-700 border-amber-200',
}

export function CasesTable({ rows }: { rows: CaseRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function remove(id: number) {
    if (!confirm('确定删除该案例？删除后前台将不可访问。')) return
    setBusyId(id)
    try {
      await fetch(`/api/admin/cases/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">案例</th>
              <th className="px-5 py-3 font-medium">分类 / 行业</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">排序</th>
              <th className="px-5 py-3 font-medium">更新时间</th>
              <th className="px-5 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-mist/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 font-medium text-ink">
                      {row.title}
                      {row.isFeatured ? (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600">
                          首页推荐
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-400">/cases/{row.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {row.categoryName || '-'} {row.industry ? `· ${row.industry}` : ''}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${
                        STATUS_STYLE[row.status] || STATUS_STYLE.DRAFT
                      }`}
                    >
                      {STATUS_LABEL[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs tabular-nums text-slate-500">{row.sort}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(row.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/cases/${row.slug}`}
                        target="_blank"
                        className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:text-brand-700"
                      >
                        预览
                      </Link>
                      <Link
                        href={`/admin/cases/${row.id}`}
                        className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(row.id)}
                        className="rounded-md border border-line p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
                        aria-label="删除"
                        disabled={busyId === row.id}
                      >
                        {busyId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-400">
                  暂无案例，点击右上角新增
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
