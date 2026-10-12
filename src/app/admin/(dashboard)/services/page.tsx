import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { AdminListActions } from '@/components/admin/list-actions'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下架',
}

export default async function AdminServicesPage() {
  await requirePermission('services')
  const services = await prisma.service.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })

  return (
    <div className="space-y-6">
      <PageHeader
        title="服务管理"
        desc="以后新增业务（如小红书代运营）直接在后台添加即可，无需改代码。"
        action={
          <Link href="/admin/services/new" className="btn-primary">
            <Plus className="h-4 w-4" /> 新增服务
          </Link>
        }
      />

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">服务名称</th>
                <th className="px-5 py-3 font-medium">简介</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">排序</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {services.length ? (
                services.map((item) => (
                  <tr key={item.id} className="hover:bg-mist/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{item.name}</div>
                      <div className="text-xs text-slate-400">/services/{item.slug}</div>
                    </td>
                    <td className="max-w-[280px] truncate px-5 py-3 text-xs text-slate-500">
                      {item.summary}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {STATUS_LABEL[item.status] || item.status}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums text-slate-500">{item.sort}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <AdminListActions
                          editHref={`/admin/services/${item.id}`}
                          previewHref={`/services/${item.slug}`}
                          apiPath={`/api/admin/services/${item.id}`}
                          confirmText={`确定删除服务「${item.name}」？`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-400">
                    暂无服务，点击右上角新增
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
