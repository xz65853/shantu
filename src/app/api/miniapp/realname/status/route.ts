import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { realNameView } from '@/lib/realname'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/** 查询当前会员实名认证状态（含是否需要强制的开关） */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)
    const member = await prisma.member.findUnique({ where: { id: payload.id } })
    if (!member) return fail('会员不存在', 404)

    const settings = await getSettings()
    const faceEnabled = settings.face_verify_enable === '1'
    const manualEnabled = !!((settings.idcard_verify_provider || '').trim())
    return ok({
      ...realNameView(member),
      required: settings.realname_required === '1',
      enabled: faceEnabled || manualEnabled,
    })
  })
}
