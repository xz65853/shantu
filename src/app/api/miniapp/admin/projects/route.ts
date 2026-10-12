import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api'
import { getMiniAdmin } from '@/lib/mini-admin-auth'

export const dynamic = 'force-dynamic'

/** 进行中项目列表（手机端） */
export async function GET(req: NextRequest) {
  const admin = await getMiniAdmin(req)
  if (!admin) return fail('您没有权限访问', 403, 403)

  const list = await prisma.project.findMany({
    where: { status: { in: ['PENDING', 'RUNNING', 'PAUSED'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      packageName: true,
      manager: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  })

  return ok({ list })
}
