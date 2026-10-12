import { requirePermission } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { PageHeader } from '@/components/admin/page-header'
import { SettingsForm } from '@/components/admin/settings-form'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  await requirePermission('settings')
  const settings = await getSettings()

  return (
    <div className="space-y-6">
      <PageHeader title="网站设置" desc="修改公司名称、联系方式与 SEO 信息，前台自动更新。" />
      <SettingsForm initial={settings} />
    </div>
  )
}
