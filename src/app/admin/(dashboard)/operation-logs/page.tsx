import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { OperationLogs } from '@/components/admin/operation-logs'

export const dynamic = 'force-dynamic'

export default async function OperationLogsPage() {
  await requirePermission('logs')
  return (
    <div className="space-y-6">
      <PageHeader title="操作日志" desc="关键写操作的前后快照，可字段级对比（只读，不可修改删除）。" />
      <OperationLogs />
    </div>
  )
}
