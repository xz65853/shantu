import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { LoginLogs } from '@/components/admin/login-logs'

export const dynamic = 'force-dynamic'

export default async function LoginLogsPage() {
  await requirePermission('logs')
  return (
    <div className="space-y-6">
      <PageHeader title="登录日志" desc="管理员登录成功 / 失败记录，含 IP 与 UA（只读，不可修改删除）。" />
      <LoginLogs />
    </div>
  )
}
