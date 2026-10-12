import { AiConfigManager } from '@/components/admin/ai-config-manager'
import { PageHeader } from '@/components/admin/page-header'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminAiConfigPage() {
  await requirePermission('settings')
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 配置"
        desc="配置大模型提供商与 API Key，用于后台一键生成月报总结、AI 解析报表，以及小程序客户 AI 助手"
      />
      <AiConfigManager />
    </div>
  )
}
