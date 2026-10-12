import { requirePermission } from '@/lib/auth'
import { ServiceForm } from '@/components/admin/service-form'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default async function ServiceNewPage() {
  await requirePermission('services')
  return (
    <div className="space-y-6">
      <PageHeader title="新增服务" desc="保存后前台服务列表与详情页自动生成。" />
      <ServiceForm
        initial={{
          name: '',
          slug: '',
          enName: '',
          icon: '',
          summary: '',
          detail: '',
          process: '',
          target: '',
          faq: '',
          cover: '',
          seoTitle: '',
          seoDesc: '',
          sort: 0,
          status: 'PUBLISHED',
        }}
      />
    </div>
  )
}
