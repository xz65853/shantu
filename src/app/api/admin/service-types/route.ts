import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requirePermission('packages')
  const list = await prisma.serviceType.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })
  return NextResponse.json({ code: 0, data: list })
}

export async function POST(req: NextRequest) {
  await requirePermission('packages')
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ code: 400, message: '请填写类型名称' }, { status: 200 })
  const row = await prisma.serviceType.create({
    data: {
      name: body.name.trim(),
      icon: body.icon || '',
      description: body.description || '',
      enabled: body.enabled !== false,
      fieldsConfig: body.fieldsConfig || '',
      reportConfig: body.reportConfig || '',
      aiContext: body.aiContext || '',
      sort: Number(body.sort) || 0,
    },
  })
  return NextResponse.json({ code: 0, data: row })
}
