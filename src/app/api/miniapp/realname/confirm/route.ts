import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { decryptIdCard, markVerified, wechatQueryVerifyInfo } from '@/lib/realname'

export const dynamic = 'force-dynamic'

const schema = z.object({
  verifyId: z.string().min(1, '缺少核身会话'),
  outSeqNo: z.string().min(5, '缺少流水号'),
})

/**
 * 人脸核身确认：后端调 queryVerifyInfo 二次校验，不信任前端。
 * 通过条件：errcode=0 且 verify_ret=10000。
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const member = await prisma.member.findUnique({ where: { id: payload.id } })
    if (!member) return fail('会员不存在', 404)
    if (member.isRealVerified) return ok({ verified: true })

    const body = await parseBody(req, schema)
    const row = await prisma.realNameAuth.findFirst({
      where: {
        memberId: member.id,
        transactionId: body.verifyId,
        status: 'PENDING',
        verifyChannel: 'wechat_face',
      },
    })
    if (!row) return fail('核身会话不存在或已失效，请重新认证', 404)

    const idCard = decryptIdCard(row.idCardNoEnc)
    if (!idCard) return fail('身份信息缺失，请重新认证', 400)

    const r = await wechatQueryVerifyInfo({
      verifyId: body.verifyId,
      outSeqNo: body.outSeqNo,
      name: row.realName,
      idCard,
      openid: member.openId || '',
    })

    if (!r.ok) {
      await prisma.realNameAuth.update({
        where: { id: row.id },
        data: { status: 'FAILED', failReason: `verify_ret=${r.verifyRet} ${r.errmsg}` },
      })
      return fail('人脸核验未通过，请重试', 400, 400)
    }

    await prisma.realNameAuth.update({
      where: { id: row.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    })
    await markVerified(member.id, row.realName, idCard, 'wechat_face', body.verifyId)
    return ok({ verified: true, channel: 'wechat_face' })
  })
}
