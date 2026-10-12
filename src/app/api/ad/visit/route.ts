import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api'
import { code2Session } from '@/lib/wechat-server'
import { getMemberFromRequest } from '@/lib/member-auth'

export const dynamic = 'force-dynamic'

/**
 * 小程序会话上报（广告监测埋点）
 *
 * 调用方：小程序 utils/track.js
 * 调用时机：停留满 30 秒兜底上报一次 → onHide 结算最终时长 → 留资成功立即上报
 *
 * 三条设计约束：
 *   1. 免登录：未登录访客也要进「访问流水」，靠 code2session 换 openid 而非 token
 *   2. 幂等：同一 visit_id 会上报多次，按 visit_id upsert，后端不可按次累加
 *   3. 后端复核：channel 由后端按 clickid 判定，不信前端单方面声明；
 *      is_new 由后端按 openid 首次出现判定，前端 local_first 仅作兜底参考
 */

function str(v: unknown, max: number): string {
  if (v == null) return ''
  return typeof v === 'string' ? v.slice(0, max) : String(v).slice(0, max)
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const visitId = str(body.visit_id, 64)
    if (!visitId) return fail('缺少 visit_id', 400, 400)

    // ---- 1. openid：优先前端传入，否则用 wx.login 的 code 换取 ----
    // 这样未登录访客也能进流水，否则流水只覆盖已登录会员，而广告新客大多未登录
    let openid = str(body.openid, 64)
    if (!openid) {
      const code = str(body.code, 200)
      if (code) {
        try {
          const s = await code2Session(code)
          openid = str(s.openid, 64)
        } catch {
          // code 失效 / 小程序未配置 → 静默降级，仍记录会话，只是没有 openid
        }
      }
    }

    // ---- 2. 会员关联：优先登录态 token，其次前端传的 member_id ----
    let memberId: number | null = null
    try {
      const payload = await getMemberFromRequest(req)
      if (payload && typeof payload.id === 'number') memberId = payload.id
    } catch {
      /* 无登录态 */
    }
    if (!memberId) {
      const mid = Number(str(body.member_id, 20))
      if (Number.isFinite(mid) && mid > 0) memberId = mid
    }

    // ---- 2.5 会员兜底：既无 token 也无 member_id 时，用 openid 反查会员 ----
    // 场景：小程序端埋点以 noAuth 上报（不带 Authorization，避免 401 触发清 token），
    // 若本地 member 缓存缺失，后台就会把已登录用户显示成"未登录访客"。
    // openid 是稳定的微信身份，用它反查可以把会话正确归到会员名下。
    if (!memberId && openid) {
      try {
        const m = await prisma.member.findUnique({
          where: { openId: openid },
          select: { id: true, mergedInto: true },
        })
        // 账号被合并过时归属主账号，避免统计被拆散
        if (m) memberId = m.mergedInto || m.id
      } catch {
        /* 反查失败不影响主流程 */
      }
    }

    // ---- 3. 渠道：后端复核，clickid 非空即广告 ----
    // 注意：若腾讯后台落地页宏未替换，前端会收到字面量 __CLICKID__。
    // 此时仍视为广告流量（确实来自广告落地配置），但存储时置空，
    // 避免用无效 clickid 做转化归因/回传造成脏数据。
    const rawClickid = str(body.clickid, 100)
    const isMacroUnsubstituted = /^__\w+__$/.test(rawClickid)
    const clickid = isMacroUnsubstituted ? '' : rawClickid
    const channel = rawClickid ? 'ad' : 'organic'
    const source = str(body.source, 50)

    // ---- 4. is_new：以 openid 首次出现为准（排除本次会话自身）----
    let isNew = false
    if (openid) {
      const prev = await prisma.visitLog.count({
        where: { openid, NOT: { visitId } },
      })
      isNew = prev === 0
    } else if (memberId) {
      const prev = await prisma.visitLog.count({
        where: { memberId, NOT: { visitId } },
      })
      isNew = prev === 0
    } else {
      // 既无 openid 也无会员 → 只能信前端本地标记
      isNew = Number(body.local_first) === 1
    }

    // ---- 5. 路径与落地页 ----
    const rawPath = Array.isArray(body.path) ? body.path : []
    const pathArr = rawPath.map((p) => str(p, 40)).slice(0, 20)
    const pathSeq = JSON.stringify(pathArr)
    const entryPage = str(body.entry_page, 255) || str(pathArr[0], 255)

    const durationRaw = Number(body.duration)
    const duration =
      Number.isFinite(durationRaw) && durationRaw >= 0
        ? Math.min(Math.round(durationRaw), 86400)
        : null

    // 会话开始时间：前端给的 first_at，做合理性钳制防止时钟异常污染统计
    const firstAtRaw = Number(body.first_at)
    const createdAt =
      Number.isFinite(firstAtRaw) && firstAtRaw > 0
        ? new Date(Math.min(firstAtRaw, Date.now() + 60_000))
        : undefined

    const ip =
      (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim().slice(0, 45) ||
      req.headers.get('x-real-ip') ||
      null

    const isLead = body.is_lead === true || Number(body.is_lead) === 1

    // ---- 6. 读取既有记录：身份 / 渠道 / 来源只补不降 ----
    // 同一会话会上报多次（30 秒兜底 + onHide 结算）：
    //  - 身份：后一次拿不到 member/openid 时，不能把前一次已识别的抹掉
    //  - 渠道：只要任一次带 clickid 就定格为 ad，不允许后续无 clickid 的上报降级成 organic
    //  - 来源：clickid 判出的「腾讯广告」优先级高于场景值判出的细分来源，不被覆盖
    const existing = await prisma.visitLog.findUnique({
      where: { visitId },
      select: { memberId: true, openid: true, channel: true, source: true, clickid: true },
    })
    const finalMemberId = memberId || existing?.memberId || null
    const finalOpenid = openid || existing?.openid || null
    const finalChannel = channel === 'ad' || !existing?.channel ? channel : existing.channel
    const finalSource =
      source === '腾讯广告' || !existing?.source ? source || existing?.source || null : existing.source
    const finalClickid = clickid || existing?.clickid || null

    const base = {
      // path 保持与 /api/miniapp/track 一致的 MINI: 前缀，兼容现有流水展示
      path: `MINI:${entryPage || '/'}`,
      openid: finalOpenid,
      memberId: finalMemberId,
      channel: finalChannel,
      clickid: finalClickid,
      source: finalSource,
      scene: str(body.scene, 20) || null,
      entryPage: entryPage || null,
      pathSeq,
      duration,
      isNew,
      ua: (req.headers.get('user-agent') || '').slice(0, 255) || 'miniapp',
      ip,
    }

    await prisma.visitLog.upsert({
      where: { visitId },
      create: {
        visitId,
        ...base,
        isLead,
        ...(createdAt ? { createdAt } : {}),
      },
      update: {
        ...base,
        // 留资一旦为 true 不允许被后续上报覆盖成 false
        ...(isLead ? { isLead: true } : {}),
        // createdAt 不更新：保持会话首次进入时间
      },
    })

    return ok({ recorded: true, is_new: isNew, channel })
  })
}
