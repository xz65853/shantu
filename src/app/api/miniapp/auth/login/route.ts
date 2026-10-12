import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok, parseBody } from '@/lib/api'
import { z } from 'zod'
import { createMemberToken } from '@/lib/member-auth'
import { code2Session, getPhoneNumberByCode } from '@/lib/wechat-server'
import { mergeMembers } from '@/lib/member-merge'

const schema = z.object({
  // wx.login 的 code（换 openid）
  code: z.string({ required_error: '缺少微信登录 code' }).min(1, '缺少微信登录 code'),
  // 手机号快速验证组件 getPhoneNumber 回调的 code（换手机号，必填）
  phoneCode: z.string({ required_error: '请授权手机号' }).min(1, '请授权手机号'),
  nickname: z.string().trim().max(60).optional(),
  // 广告归因：小程序启动参数带下来的 clickid/adSource
  clickid: z.string().trim().max(100).optional(),
  adSource: z.string().trim().max(40).optional(),
})

/**
 * 小程序登录（手机号授权，一键登录）。
 * 不再采集头像：登录只需 code + phoneCode，未授权手机号一律拒绝登录。
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await parseBody(req, schema)
    const session = await code2Session(body.code)
    const phone = await getPhoneNumberByCode(body.phoneCode)

    // 匹配 / 创建会员（与历史登录逻辑一致）
    let member = await prisma.member.findFirst({ where: { openId: session.openid, deletedAt: null } })
    if (!member && session.unionid) {
      member = await prisma.member.findFirst({ where: { unionId: session.unionid, mergedInto: null, deletedAt: null } })
    }
    if (!member) {
      try {
        const clickid = (body.clickid || '').trim() || null
        const adSourceVal = clickid ? ((body.adSource || 'tencent').trim() || null) : null
        const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim().slice(0, 45)
          || req.headers.get('x-real-ip') || null
        member = await prisma.member.create({
          data: {
            type: 'MINI',
            openId: session.openid,
            unionId: session.unionid || null,
            source: 'miniapp',
            clickid,
            adSource: adSourceVal,
            registeredSource: clickid ? (adSourceVal || 'tencent') : 'organic',
            registeredIp: ip,
            lastLoginIp: ip,
          },
        })
      } catch (e) {
        const errCode = (e as { code?: string })?.code
        if (errCode === 'P2002') {
          member = await prisma.member.findFirst({ where: { openId: session.openid } })
        }
        if (!member) throw e
      }
    }
    if (member.mergedInto) {
      const primary = await prisma.member.findUnique({ where: { id: member.mergedInto } })
      if (primary) member = primary
    }
    if (member.status === 'BLOCKED') return fail('账号已被禁用，请联系客服', 403)

    // 手机号被其他账号占用 → 合并到当前微信账号（订单/项目迁移，旧账号标记 mergedInto）
    const occupied = await prisma.member.findFirst({
      where: { phone, id: { not: member.id }, mergedInto: null },
    })
    if (occupied) {
      try {
        await mergeMembers(member.id, occupied.id, { operator: 'system' })
      } catch {
        return fail('手机号关联账号合并失败，请联系客服', 409)
      }
    }

    const loginIp = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim().slice(0, 45)
      || req.headers.get('x-real-ip') || null
    const incomingClickid = (body.clickid || '').trim() || null
    const updateData: Record<string, unknown> = {
      phone,
      nickname: body.nickname || member.nickname,
      lastLoginAt: new Date(),
      lastLoginIp: loginIp,
      unionId: session.unionid || member.unionId,
      source: member.source === 'web' && session.unionid ? 'both' : member.source,
    }
    // 老会员首次点广告进来登录，补记渠道（不覆盖已有的自然/广告标记）
    if (!member.clickid && incomingClickid) {
      updateData.clickid = incomingClickid
      updateData.adSource = (body.adSource || 'tencent').trim() || null
      updateData.registeredSource = (body.adSource || 'tencent').trim() || 'tencent'
    }
    const updated = await prisma.member.update({
      where: { id: member.id },
      data: updateData,
    })

    const token = await createMemberToken({
      id: updated.id,
      type: 'MINI',
      phone: updated.phone || '',
      name: updated.nickname || updated.name || '',
    })

    return ok({
      token,
      member: {
        id: updated.id,
        type: updated.type,
        phone: updated.phone,
        nickname: updated.nickname,
        avatar: updated.avatar,
        hasPhone: Boolean(updated.phone),
      },
    })
  })
}
