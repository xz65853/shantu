import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { RecycleBin } from '@/components/admin/recycle-bin'

export const dynamic = 'force-dynamic'

export default async function RecyclePage() {
  await requirePermission('recycle')
  return (
    <div className="space-y-6">
      <PageHeader title="回收站" desc="软删除的订单 / 会员 / 线索都在这里，可恢复或彻底删除。" />
      <RecycleBin />
    </div>
  )
}
