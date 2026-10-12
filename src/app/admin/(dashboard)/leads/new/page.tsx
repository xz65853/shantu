import { LeadCreateForm } from './create-form'
import { PageHeader } from '@/components/admin/page-header'

export const dynamic = 'force-dynamic'

export default function LeadCreatePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="手动新增客户" desc="线下或电话获取的线索也可以录入系统进行跟进。" />
      <div className="max-w-2xl">
        <LeadCreateForm />
      </div>
    </div>
  )
}
