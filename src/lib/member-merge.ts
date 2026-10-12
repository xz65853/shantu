import { prisma } from './db'

/**
 * 会员合并：把 sourceId 账号合并进 targetId 主账号。
 * - sourceId 的订单 / 项目全部迁移到 targetId
 * - sourceId 标记 mergedInto = targetId（软合并，不删除）
 * - targetId 补齐 phone / name / nickname / passwordHash，source 置为 'both'
 * - 写一条 member_merge_logs 留痕
 */
export async function mergeMembers(
  targetId: number,
  sourceId: number,
  opts?: { operator?: string; adminId?: number },
) {
  if (!Number.isInteger(targetId) || !Number.isInteger(sourceId)) {
    throw new Error('参数错误')
  }
  if (targetId === sourceId) throw new Error('不能合并到同一账号')

  const [target, source] = await Promise.all([
    prisma.member.findUnique({ where: { id: targetId } }),
    prisma.member.findUnique({ where: { id: sourceId } }),
  ])
  if (!target || !source) throw new Error('会员不存在')
  if (target.mergedInto) throw new Error('目标账号已被合并到其他账号，请选择主账号')
  if (source.mergedInto) throw new Error('该账号已被合并过')

  await prisma.$transaction(async (tx) => {
    // 迁移订单 + 项目归属
    await tx.order.updateMany({ where: { memberId: sourceId }, data: { memberId: targetId } })
    await tx.project.updateMany({ where: { memberId: sourceId }, data: { memberId: targetId } })

    // 子账号标记 mergedInto
    await tx.member.update({ where: { id: sourceId }, data: { mergedInto: targetId } })

    // 主账号补齐缺失字段，来源标记 both
    const data: Record<string, unknown> = { source: 'both' }
    if (!target.phone && source.phone) data.phone = source.phone
    if (!target.name && source.name) data.name = source.name
    if (!target.nickname && source.nickname) data.nickname = source.nickname
    if (!target.passwordHash && source.passwordHash) data.passwordHash = source.passwordHash
    await tx.member.update({ where: { id: targetId }, data })

    // 迁移微信登录凭证（openid/unionid 唯一，子账号清空，主账号继承）
    if (!target.openId && source.openId) {
      await tx.member.update({ where: { id: sourceId }, data: { openId: null } })
      await tx.member.update({ where: { id: targetId }, data: { openId: source.openId } })
    }
    if (!target.unionId && source.unionId) {
      await tx.member.update({ where: { id: sourceId }, data: { unionId: null } })
      await tx.member.update({ where: { id: targetId }, data: { unionId: source.unionId } })
    }

    // 留痕
    await tx.memberMergeLog.create({
      data: {
        fromMemberId: sourceId,
        toMemberId: targetId,
        fromPhone: source.phone,
        toPhone: target.phone || source.phone,
        operator: opts?.operator || 'system',
        adminId: opts?.adminId ?? null,
      },
    })
  })

  return { targetId, sourceId }
}

/**
 * 解析会员主账号：若传入的会员是子账号（mergedInto 非空），返回其主账号。
 */
export async function resolvePrimaryMember(id: number) {
  const m = await prisma.member.findUnique({ where: { id } })
  if (!m) return null
  if (!m.mergedInto) return m
  const primary = await prisma.member.findUnique({ where: { id: m.mergedInto } })
  return primary || m
}
