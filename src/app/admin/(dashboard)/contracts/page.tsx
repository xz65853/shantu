import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { ContractsManager, type ContractRow } from '@/components/admin/contracts-manager'

export const dynamic = 'force-dynamic'

export default async function AdminContractsPage() {
  await requirePermission('packages')

  const list = await prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      order: { select: { orderNo: true, packageName: true, status: true, name: true, phone: true, member: { select: { deletedAt: true } } } },
    },
  })

  const rows: ContractRow[] = list.map((c) => ({
    id: c.id,
    contractNo: c.contractNo,
    name: c.order?.name || c.partyAName,
    phone: c.order?.phone || c.partyAPhone,
    packageName: c.order?.packageName || '',
    orderNo: c.order?.orderNo || '',
    amount: c.amount,
    status: c.status,
    orderStatus: c.order?.status || '',
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    pdfUrl: c.pdfUrl,
    memberCancelled: Boolean(c.order?.member?.deletedAt),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="合同管理"
        desc="所有合同（含待签署）。待签署合同可编辑服务项/金额/日期/补充条款，已签署合同只读、仅可作废。"
      />
      <ContractsManager initial={rows} />
    </div>
  )
}
