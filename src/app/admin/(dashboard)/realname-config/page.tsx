import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { RealnameConfigManager } from '@/components/admin/realname-config-manager'

export const dynamic = 'force-dynamic'

/**
 * 实名认证配置
 * 路由：/admin/realname-config
 * 必须放在 src/app/admin/(dashboard)/ 路由组内，才能继承 AdminShell
 * （左侧导航 + 顶栏）。放在 admin/ 根下会渲染成无框架的独立页面。
 */
export default async function AdminRealnameConfigPage() {
  await requirePermission('settings')

  return (
    <div className="space-y-6">
      <PageHeader
        title="实名认证配置"
        desc="配置实名认证渠道及对应密钥。AppCode 加密存储，保存后不可明文查看；配置保存后小程序端立即生效，无需发版。"
      />
      <RealnameConfigManager />
    </div>
  )
}
