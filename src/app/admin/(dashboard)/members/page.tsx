import { MembersManager } from '@/components/admin/members-manager'
import { PageHeader } from '@/components/admin/page-header'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminMembersPage() {
  await requirePermission('members')
  return (
    <div className="space-y-6">
      <PageHeader
        title="会员管理"
        desc="官网登录客户与小程序微信客户统一管理，可备注、禁用"
      />
      <MembersManager />
    </div>
  )
}
