import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'

/**
 * 小程序页面访问埋点
 * 小程序端在 App.onShow / 页面 onShow 时调用，上报当前页面路径
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const member = await getMemberFromRequest(req)
    const body = await req.json().catch(() => ({}))
    const path = (body.path || '').toString().slice(0, 255) || '/miniapp'

    const ip =
      (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim().slice(0, 45) ||
      req.headers.get('x-real-ip') ||
      null

    await prisma.visitLog.create({
      data: {
        path: 'MINI:' + path,
        referer: null,
        ua: (req.headers.get('user-agent') || '').slice(0, 255) || 'miniapp',
        ip,
        memberId: member?.id || null,
      },
    })

    return ok({ recorded: true })
  })
}
