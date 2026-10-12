import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { AdminsManager, type AdminRow } from '@/components/admin/admins-manager'

export const dynamic = 'force-dynamic'

export default async function AdminAdminsPage() {
  await requirePermission('admins')
  const admins = await prisma.admin.findMany({ orderBy: { id: 'asc' } })

  const rows: AdminRow[] = admins.map((a) => ({
    id: a.id,
    username: a.username,
    displayName: a.displayName,
    role: a.role,
    isActive: a.isActive,
    phone: a.phone || '',
    remark: a.remark || '',
    openId: a.openId || '',
    lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="管理员"
        desc="超级管理员拥有全部权限；运营/财务/只读按角色限制。绑定微信后可在小程序「我的」进入手机端管理后台。"
      />
      <AdminsManager rows={rows} />
    </div>
  )
}
