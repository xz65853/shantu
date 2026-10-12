import { prisma } from './db'

/**
 * 统一业务编号生成（订单号 / 合同号共用）
 *
 * 格式：ST + YYYYMMDDHHmm(12位) + 会员编号后4位 + 4位防伪码
 * 示例：ST2026092914300056AB7X
 *   ST | 202609291430 | 0056 | AB7X
 *
 * 防伪码字符集：ABCDEFGHJKMNPQRSTUVWXYZ23456789（去掉 0/O、1/I/L 易混淆字符）
 * 生成后查库去重，最多重试 5 次；仍冲突则追加时间戳兜底。
 */

/** 防伪码字符集（去掉 0 O 1 I L） */
const ANTI_FAKE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** 从会员编号取后 4 位（如 ST000056 -> 0056）；无会员时用随机 4 位 */
function last4OfMember(userId: string | null | undefined): string {
  if (userId && userId.length >= 4) {
    return userId.slice(-4)
  }
  // 游客 / 无会员订单：用随机 4 位（避免暴露「无会员」信息）
  let s = ''
  for (let i = 0; i < 4; i += 1) s += ANTI_FAKE_CHARS[Math.floor(Math.random() * ANTI_FAKE_CHARS.length)]
  return s
}

/** 生成 4 位防伪码（大写字母+数字，去掉易混淆字符） */
function genAntiFake(): string {
  let s = ''
  for (let i = 0; i < 4; i += 1) s += ANTI_FAKE_CHARS[Math.floor(Math.random() * ANTI_FAKE_CHARS.length)]
  return s
}

/** 生成时间部分：YYYYMMDDHHmm（12 位，24 小时制） */
function genTimePart(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`
}

/** 是否已存在该编号（按 type 查对应表） */
async function exists(type: 'order' | 'contract', no: string): Promise<boolean> {
  if (type === 'order') {
    const hit = await prisma.order.findUnique({ where: { orderNo: no }, select: { id: true } })
    return Boolean(hit)
  }
  const hit = await prisma.contract.findUnique({ where: { contractNo: no }, select: { id: true } })
  return Boolean(hit)
}

/**
 * 生成订单号 / 合同号
 * @param type 'order' | 'contract'
 * @param memberUserId 会员编号（如 ST000056）；游客订单传空
 */
export async function generateBizNo(type: 'order' | 'contract', memberUserId?: string | null): Promise<string> {
  const timePart = genTimePart()
  const memberTail = last4OfMember(memberUserId)

  for (let i = 0; i < 5; i += 1) {
    const antiFake = genAntiFake()
    const no = `ST${timePart}${memberTail}${antiFake}`
    if (!(await exists(type, no))) return no
  }

  // 兜底：追加时间戳毫秒后6位，几乎不可能重复
  const fallback = `ST${timePart}${memberTail}${Date.now().toString().slice(-6)}`
  return fallback
}

/** 按会员 id 取会员编号，便于下单时拿后 4 位 */
export async function memberTailByMemberId(memberId: number | null | undefined): Promise<string> {
  if (!memberId) return last4OfMember(null)
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { userId: true } })
  return last4OfMember(m?.userId)
}

/**
 * 项目编号：XM + 6 位自增 id（如 XM000123）。
 * 与会员编号 ST000001 同风格，创建项目后用自增 id 回填，唯一且不可改。
 */
export function genProjectNo(id: number): string {
  return `XM${String(id).padStart(6, '0')}`
}
