import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, guard, handle, ok } from '@/lib/api'

export const dynamic = 'force-dynamic'

/** 作废合同（已签署合同也能作废，但不可改字段） */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, admin } = await guard('packages')
  if (error) return error

  return handle(async () => {
    const { id } = await params
    const contract = await prisma.contract.findUnique({ where: { id: Number(id) } })
    if (!contract) return fail('合同不存在', 404)
    if (contract.status === 'VOID') return fail('合同已作废', 400)

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'VOID', version: contract.version + 1 },
    })

    await prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        version: updated.version,
        adminId: admin?.id,
        adminName: admin?.username || '',
        changesJson: JSON.stringify([{ field: '状态', before: contract.status, after: 'VOID' }]),
        remark: '作废',
      },
    })

    return ok({ status: updated.status }, '合同已作废')
  })
}
