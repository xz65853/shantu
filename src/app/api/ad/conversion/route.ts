import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'

export const dynamic = 'force-dynamic'

/**
 * 广告转化上报
 * body: { clickid: string, event: 'lead' | 'order' }
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json()
    const { clickid, event } = body

    if (!clickid) return ok({ success: true }) // 没有clickid就不处理

    const update: any = {}
    if (event === 'lead') {
      update.isConverted = true
      update.convertedAt = new Date()
    } else if (event === 'order') {
      update.isOrdered = true
      if (!update.isConverted) {
        update.isConverted = true
        update.convertedAt = new Date()
      }
    }

    await prisma.adClick.updateMany({
      where: { clickid },
      data: update,
    })

    return ok({ success: true })
  })
}
