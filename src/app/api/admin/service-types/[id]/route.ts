import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await requirePermission('packages')
  const id = Number(params.id)
  const body = await req.json()
  const row = await prisma.serviceType.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      icon: body.icon,
      description: body.description,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      fieldsConfig: body.fieldsConfig,
      reportConfig: body.reportConfig,
      aiContext: body.aiContext,
      sort: body.sort !== undefined ? Number(body.sort) : undefined,
    },
  })
  return NextResponse.json({ code: 0, data: row })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await requirePermission('packages')
  const id = Number(params.id)
  await prisma.serviceType.delete({ where: { id } })
  return NextResponse.json({ code: 0 })
}
