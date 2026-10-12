import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { getMemberFromRequest } from '@/lib/member-auth'
import { rateLimited } from '@/lib/rate-limit'
import { getSettings } from '@/lib/settings'
import {
  encryptIdCard,
  isValidIdCard,
  isValidName,
  manualVerifyIdCard,
  markVerified,
  normalizeIdCard,
  wechatGetVerifyId,
} from '@/lib/realname'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2, '请填写真实姓名').max(40),
  idCard: z.string().trim().min(15, '身份证号格式不正确').max(18),
})

/**
 * 发起实名认证：
 * - 已认证 → verified:true（后续订单免认证）
 * - 微信人脸核身开启 → 返回 verifyId，前端 wx.requestFacialVerify
 * - 未开启 → manual 二要素核验，通过即落库
 * 限流：10 分钟 5 次，防刷接口
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const payload = await getMemberFromRequest(req)
    if (!payload) return fail('请先登录', 401, 401)

    const member = await prisma.member.findUnique({ where: { id: payload.id } })
    if (!member) return fail('会员不存在', 404)
    if (member.isRealVerified) return ok({ verified: true })

    if (rateLimited(`realname:${member.id}`, 5, 600_000)) {
      return fail('认证次数过于频繁，请 10 分钟后再试', 429, 429)
    }

    const body = await parseBody(req, schema)
    const name = body.name.trim()
    const idCard = normalizeIdCard(body.idCard)
    if (!isValidName(name)) return fail('请填写正确的真实姓名', 400)
    if (!isValidIdCard(idCard)) return fail('身份证号格式不正确', 400)

    const settings = await getSettings()
    const faceEnabled = settings.face_verify_enable === '1'

    if (faceEnabled) {
      if (!member.openId) return fail('当前账号未绑定微信，无法人脸核身', 400)
      let verifyId = ''
      let outSeqNo = ''
      try {
        const r = await wechatGetVerifyId({ openid: member.openId, name, idCard })
        verifyId = r.verifyId
        outSeqNo = r.outSeqNo
      } catch (e) {
        return fail((e as Error).message || '人脸核身暂不可用，请稍后重试', 400)
      }
      await prisma.realNameAuth.create({
        data: {
          memberId: member.id,
          openid: member.openId,
          realName: name,
          idCardNoEnc: encryptIdCard(idCard),
          status: 'PENDING',
          verifyChannel: 'wechat_face',
          transactionId: verifyId,
        },
      })
      return ok({ verified: false, channel: 'wechat_face', verifyId, outSeqNo })
    }

    // 降级：manual 二要素
    let result
    try {
      result = await manualVerifyIdCard(name, idCard)
    } catch (e) {
      await prisma.realNameAuth.create({
        data: {
          memberId: member.id,
          openid: member.openId,
          realName: name,
          idCardNoEnc: encryptIdCard(idCard),
          status: 'FAILED',
          verifyChannel: 'manual_idcard',
          failReason: (e as Error).message,
        },
      })
      return fail((e as Error).message || '实名核验失败', 400)
    }

    if (!result.ok) {
      await prisma.realNameAuth.create({
        data: {
          memberId: member.id,
          openid: member.openId,
          realName: name,
          idCardNoEnc: encryptIdCard(idCard),
          status: 'FAILED',
          verifyChannel: 'manual_idcard',
          transactionId: result.transactionId,
          failReason: result.message,
        },
      })
      return fail(result.message || '实名核验未通过', 400)
    }

    await prisma.realNameAuth.create({
      data: {
        memberId: member.id,
        openid: member.openId,
        realName: name,
        idCardNoEnc: encryptIdCard(idCard),
        status: 'VERIFIED',
        verifyChannel: 'manual_idcard',
        transactionId: result.transactionId,
        verifiedAt: new Date(),
      },
    })
    await markVerified(member.id, name, idCard, 'manual_idcard', result.transactionId)
    return ok({ verified: true, channel: 'manual_idcard' })
  })
}
