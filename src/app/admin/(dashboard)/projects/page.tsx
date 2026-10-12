import { ProjectsManager } from '@/components/admin/projects-manager'
import { PageHeader } from '@/components/admin/page-header'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminProjectsPage() {
  await requirePermission('projects')
  return (
    <div className="space-y-6">
      <PageHeader
        title="项目管理"
        desc="客户购买服务后创建项目，跟进执行状态并发布月度运营报告；客户在小程序「我的项目」中查看"
      />
      <ProjectsManager />
    </div>
  )
}
