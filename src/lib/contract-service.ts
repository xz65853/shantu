import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { generateContractPdf, applySignature, applyPartyBSign, fetchImage } from '@/lib/contract-pdf'
import { decryptIdCard, maskIdCard } from '@/lib/realname'
import { generateBizNo } from '@/lib/orderNo'
import { getSettings } from '@/lib/settings'

/**
 * 合同服务层
 * ------------------------------------------------------------------
 * 1) 服务期限算法写死：月度 31 天 / 季度 93 天 / 年度 372 天，不按自然月推算
 * 2) 开始日期 = 用户签署当天 00:00:00；结束日期 = 开始日期 + N 天 - 1 天
 * 3) 合同 PDF 一律后端渲染（pdfkit），前端不拼 HTML、不自行合成签名
 */

/** 套餐周期 → 服务天数（写死） */
export const SERVICE_DAYS: Record<string, number> = {
  MONTH: 31,
  QUARTER: 93,
  YEAR: 372,
  // 后台套餐 period 实际存的是中文：月 / 季度 / 年 / 一次性 / 单次
  月: 31,
  月度: 31,
  季度: 93,
  季: 93,
  年: 372,
  年度: 372,
  日: 1,
  一次性: 1,
  单次: 1,
}

/** 周期 → 天数（兜底 31 天） */
export function serviceDaysFor(period?: string | null): number {
  if (!period) return 31
  const raw = String(period).trim()
  if (SERVICE_DAYS[raw] !== undefined) return SERVICE_DAYS[raw]
  const upper = raw.toUpperCase()
  if (SERVICE_DAYS[upper] !== undefined) return SERVICE_DAYS[upper]
  if (raw.includes('年')) return 372
  if (raw.includes('季')) return 93
  if (raw.includes('月')) return 31
  if (raw.includes('日') || raw.includes('一次性') || raw.includes('单次') || raw.includes('次')) return 1
  return 31
}

/** 解析 JSON 数组字符串（services_json / features 均可能） */
export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean)
  } catch {
    /* 非法 JSON 视为空 */
  }
  return []
}

/** 服务项清单 → 编号列表文本（一、服务内容 下的 1. 2. 3. ...） */
export function renderServicesList(raw: string | null | undefined): string {
  const items = parseJsonArray(raw)
  if (!items.length) return ''
  return items.map((s, i) => `${i + 1}. ${s}`).join('\n')
}

/** 签署时间格式化：2026-09-30 02:07（北京时间，服务器时区即 CST） */
export function fmtSignedAt(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

/** 中文日期：2026年09月28日 */
export function formatCnDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}年${m}月${day}日`
}

/** 手机号脱敏：138****0000 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return ''
  const s = String(phone).trim()
  if (s.length !== 11) return s
  return `${s.slice(0, 3)}****${s.slice(-4)}`
}

/** 分 → ¥3,000.00 */
export function yuan(cents: number): string {
  return (cents / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** 分 → 人民币大写（如 300000 → 叁仟元整） */
export function amountToChinese(cents: number): string {
  const n = Math.round(Math.abs(cents)) / 100
  if (n === 0) return '零元整'
  const intPart = Math.floor(n)
  const fraction = Math.round((n - intPart) * 100)
  const digits = '零壹贰叁肆伍陆柒捌玖'
  const radices = ['', '拾', '佰', '仟']
  const bigRadices = ['', '万', '亿']

  let integer = ''
  if (intPart === 0) {
    integer = '零'
  } else {
    let zeroCount = 0
    const numStr = String(intPart)
    for (let i = 0; i < numStr.length; i++) {
      const p = numStr.length - i - 1
      const d = Number(numStr[i])
      const quotient = Math.floor(p / 4)
      const modulus = p % 4
      if (d === 0) {
        zeroCount++
      } else {
        if (zeroCount > 0) integer += '零'
        zeroCount = 0
        integer += digits[d] + radices[modulus]
      }
      if (modulus === 0 && zeroCount < 4) {
        integer += bigRadices[quotient]
      }
    }
  }
  integer += '元'

  let decimal = ''
  if (fraction === 0) {
    decimal = '整'
  } else {
    const jiao = Math.floor(fraction / 10)
    const fen = fraction % 10
    if (jiao > 0) decimal += digits[jiao] + '角'
    if (fen > 0) decimal += digits[fen] + '分'
  }
  return (cents < 0 ? '负' : '') + integer + decimal
}

/** 附加条款 JSON → 编号文本（如：1. 营业额分成条款：...） */
export function renderClauses(clausesJson: string | null | undefined): string {
  if (!clausesJson) return ''
  try {
    const arr = JSON.parse(clausesJson)
    if (!Array.isArray(arr)) return ''
    return arr
      .map((c, i) => {
        const name = String(c?.name || '').trim()
        const content = String(c?.content || '').trim()
        if (!content && !name) return ''
        return name ? `${i + 1}. ${name}：${content}` : `${i + 1}. ${content}`
      })
      .filter(Boolean)
      .join('\n')
  } catch {
    return ''
  }
}

export type ServicePeriod = {
  days: number
  startAt: Date
  endAt: Date
  periodStart: string
  periodEnd: string
  periodText: string
  periodRangeText: string
}

/**
 * 计算服务期限。days 可显式传入（套餐 period_days 快照优先），
 * 否则按 period 中文/枚举映射。
 * 例：2026-09-28 签月度 → 09-28 + (31-1) 天 = 10-28，共 31 天
 */
export function computeServicePeriod(start: Date, period?: string | null, daysOverride?: number | null): ServicePeriod {
  const days = daysOverride && daysOverride > 0 ? daysOverride : serviceDaysFor(period)
  const startAt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0)
  const endAt = new Date(startAt.getTime() + (days - 1) * 86400000)
  const periodStart = formatCnDate(startAt)
  const periodEnd = formatCnDate(endAt)
  return {
    days,
    startAt,
    endAt,
    periodStart,
    periodEnd,
    periodText: `${days} 天`,
    periodRangeText: `${periodStart} 至 ${periodEnd}，共${days}天`,
  }
}

/** 服务内容文本（用于列表/详情展示）：套餐名 + 服务项顿号拼接 */
export function buildServiceContent(
  pkg: { name?: string | null; summary?: string | null; features?: string | null; servicesJson?: string | null } | null,
  order: { packageName?: string | null; serviceContent?: string | null }
): string {
  if (order.serviceContent && order.serviceContent.trim()) return order.serviceContent.trim()
  let items = parseJsonArray(pkg?.servicesJson ?? null)
  if (!items.length) items = parseJsonArray(pkg?.features ?? null)
  const detail = items.length ? items.join('、') : (pkg?.summary || '').trim()
  const name = (order.packageName || pkg?.name || '').trim()
  if (!name) return detail
  return detail ? `${name}：${detail}` : name
}

export type ContractWithTemplate = Awaited<ReturnType<typeof loadContract>>

async function loadContract(contractId: number) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    include: { template: true, order: true },
  })
}

/** 合同占位符数据表 */
export function buildContractData(
  contract: {
    contractNo?: string | null
    partyAName: string
    partyAPhone: string
    partyACompany?: string | null
    serviceContent: string
    servicesJson?: string | null
    terms?: string | null
    clausesJson?: string | null
    amount: number
    periodStart?: string | null
    periodEnd?: string | null
    serviceDays?: number | null
    periodText?: string | null
  },
  template?: {
    partyBName?: string | null
    partyBPhone?: string | null
    partyBCreditCode?: string | null
    partyBType?: string | null
    partyBLegalRep?: string | null
  } | null,
  real?: { realName?: string | null; idCardMasked?: string | null },
  opts?: { paid?: boolean; signedAt?: Date | string | null }
): Record<string, string> {
  const money = `¥${yuan(contract.amount)}`
  const partyA = (contract.partyACompany || '').trim() || contract.partyAName
  const start = contract.periodStart || ''
  const end = contract.periodEnd || ''
  const days = contract.serviceDays || 31
  // 实名信息：认证姓名为准（二选一），身份证脱敏
  const realName = (real?.realName || '').trim()
  const idCardMasked = (real?.idCardMasked || '').trim()
  // 服务内容：套餐快照渲染编号列表；无快照回退旧文本
  const serviceList = renderServicesList(contract.servicesJson) || contract.serviceContent || ''
  const terms = (contract.terms || '').trim()
  // 附加条款：优先渲染已选条款快照，否则回退补充条款文本
  const clausesText = renderClauses(contract.clausesJson) || terms
  // 乙方签署方式：个体户→负责人签字；公司→盖章
  // 未付款不渲染任何签章（防止未付款拿到带章合同）；付款后重渲染自动补齐
  const paid = opts?.paid !== false
  const partyBType = template?.partyBType || 'individual'
  const legalRep = (template?.partyBLegalRep || '').trim()
  const partyBSign = !paid
    ? ''
    : partyBType === 'company'
      ? '（盖章）'
      : legalRep
        ? `　负责人签字：${legalRep}`
        : '　负责人签字：________'
  // 签署日期：已签署用实际签署时间，未签署用服务开始日（预览）
  const signedRaw = opts?.signedAt
  const signedDate = signedRaw ? (signedRaw instanceof Date ? signedRaw : new Date(signedRaw)) : null
  const signDateText =
    signedDate && !Number.isNaN(signedDate.getTime()) ? formatCnDate(signedDate) : start
  return {
    合同编号: contract.contractNo || '',
    客户姓名: contract.partyAName || '',
    客户手机号: contract.partyAPhone || '',
    手机号: contract.partyAPhone || '',
    甲方: partyA,
    乙方: (template?.partyBName || '').trim(),
    甲方姓名: realName || partyA,
    甲方身份证号: idCardMasked,
    服务内容: serviceList,
    补充条款: terms ? `七、补充条款\n${terms}` : '',
    附加条款: clausesText,
    合同金额: money,
    金额: money,
    合同金额大写: amountToChinese(contract.amount),
    甲方电话: contract.partyAPhone || '',
    乙方名称: (template?.partyBName || '').trim(),
    乙方信用代码: (template?.partyBCreditCode || '').trim(),
    乙方电话: (template?.partyBPhone || '').trim(),
    乙方负责人: (template?.partyBLegalRep || '').trim(),
    乙方签署: partyBSign,
    甲方身份证: idCardMasked,
    服务天数: String(days),
    服务开始日期: start,
    服务结束日期: end,
    开始日期: start,
    结束日期: end,
    服务期限: contract.periodText || `${days} 天`,
    服务周期: start && end ? `${start} 至 ${end}，共${days}天` : '',
    签署日期: signDateText,
  }
}


/**
 * 渲染合同 PDF 并落盘。
 * - 未签名：正文 + 乙方公章 + 隐形水印（openid + 时间戳）
 * - 已签名：在以上基础上由【后端】把手写签名合成到甲方落款处
 */
export async function renderContractPdf(contractId: number, signatureBuffer?: Buffer): Promise<string> {
  const contract = await loadContract(contractId)
  if (!contract) throw new Error('合同不存在')
  if (!contract.order) throw new Error('合同关联订单缺失')

  const template = contract.template
  const member = contract.order.memberId
    ? await prisma.member.findUnique({ where: { id: contract.order.memberId } })
    : null

  const real = memberRealInfo(member)
  // 未付款：不渲染任何签章（甲方签名图 / 乙方公章 / 负责人签字均隐藏）
  const paid = contract.order?.status === 'PAID'
  const data = buildContractData(contract, template, real, { paid, signedAt: contract.signedAt })
  const watermark = `openid=${member?.openId || '-'} ts=${Date.now()}`
  // ===== 合同水印：后台「水印设置」驱动（客户姓名 + 身份证后4位 + 生成时间戳）=====
  const wmCfg = await getSettings()
  const cwmEnabled = wmCfg.cwm_enable !== '0'
  const cwmTemplate = wmCfg.cwm_template || '{name} {idcard4} {timestamp}'
  const realName = (real.realName || '').trim() || (contract.partyAName || '').trim()
  const idLast4 = (real.idCardMasked || '').replace(/\D/g, '').slice(-4)
  const now = new Date()
  const p2 = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`
  // 模板代入变量；无身份证号时 {idcard4} 替换为空
  const pageWatermark = cwmEnabled
    ? cwmTemplate
        .replace(/\{name\}/g, realName || '')
        .replace(/\{idcard4\}/g, idLast4 || '')
        .replace(/\{timestamp\}/g, ts)
        .replace(/\s+/g, ' ')
        .trim()
    : ''
  const watermarkStyle = {
    fontSize: Number(wmCfg.cwm_font_size) || 11,
    color: wmCfg.cwm_color || '#999999',
    opacity: Math.min(1, Math.max(0, Number(wmCfg.cwm_opacity) || 0.5)),
    rotate: Number(wmCfg.cwm_rotate) || -30,
    gapX: Number(wmCfg.cwm_gap_x) || 300,
    gapY: Number(wmCfg.cwm_gap_y) || 250,
  }

  const { buffer: pdfBuf, bodyEndY } = await generateContractPdf({
    contentHtml: template?.contentHtml || '',
    data,
    sealImageUrl: paid ? template?.sealImageUrl || null : null,
    partyBName: data['乙方'] || template?.partyBName || '',
    partyBType: paid ? template?.partyBType || 'individual' : 'individual',
    watermark,
    pageWatermark,
    watermarkStyle,
    // 每次渲染先落一份调试副本到 logs/contracts/，人工核验后再返回前端
    debugTag: `contract-${contract.order.orderNo}`,
  })
  let pdf = pdfBuf

  // 客户手写签名：本次传入优先；重渲染（后台编辑/付款后补章）时从已存签名原图恢复，
  // 修复「付款后重新生成 PDF 签名消失」问题
  let sigBuf = signatureBuffer
  if ((!sigBuf || sigBuf.length === 0) && contract.signatureImageUrl) {
    const restored = await fetchImage(contract.signatureImageUrl)
    if (restored && restored.length > 0) sigBuf = restored
  }
  // 甲方（客户）手写签名：客户签完即渲染，不受付款状态影响（客户要能看到自己签的字）
  if (sigBuf && sigBuf.length > 0) {
    pdf = await applySignature(pdf, sigBuf, bodyEndY)
  }

  // 乙方负责人手写签名图（个体户）：仅已付款渲染（assets/signature/partyB-sign.png）
  if (paid && (template?.partyBType || 'individual') === 'individual') {
    try {
      const partyBSign = fs.readFileSync(
        path.join('/www/wwwroot/shantu-web', 'assets', 'signature', 'partyB-sign.png')
      )
      if (partyBSign.length > 0) pdf = await applyPartyBSign(pdf, partyBSign, bodyEndY)
    } catch {
      /* 未配置乙方签名图时跳过 */
    }
  }

  const dir = path.join('/www/wwwroot/shantu-web', 'uploads', 'contracts')
  fs.mkdirSync(dir, { recursive: true })
  const pdfName = `contract-${contract.order.orderNo}.pdf`
  fs.writeFileSync(path.join(dir, pdfName), pdf)

  await prisma.contract.update({ where: { id: contract.id }, data: { pdfUrl: `/uploads/contracts/${pdfName}` } })
  return `/uploads/contracts/${pdfName}`
}

/**
 * 下单后自动创建合同：字段全部从订单取，PDF 立即渲染（未签名版，供签署前预览）。
 * 幂等：已存在合同则直接返回。
 */
export async function ensureContractForOrder(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { package: true } })
  if (!order) throw new Error('订单不存在')
  const memberUserId = order.memberId
    ? ((await prisma.member.findUnique({ where: { id: order.memberId }, select: { userId: true } }))?.userId ?? null)
    : null

  const exist = await prisma.contract.findUnique({ where: { orderId: order.id } })
  if (exist) {
    // 老数据补齐：编号 / 服务期限 / 服务内容；签署时会以签署当天再重算一次
    const p = computeServicePeriod(new Date(), order.period, order.periodDays)
    const patch: Record<string, unknown> = {}
    if (!exist.contractNo) patch.contractNo = await generateBizNo('contract', memberUserId)
    if (!exist.periodStart) patch.periodStart = p.periodStart
    if (!exist.periodEnd) patch.periodEnd = p.periodEnd
    if (!exist.serviceDays) patch.serviceDays = p.days
    if (!exist.periodText) patch.periodText = p.periodText
    // 未签署的合同：仅在字段为空时补填（不覆盖后台单独编辑过的值）
    if (exist.status !== 'SIGNED') {
      if (!exist.serviceContent) patch.serviceContent = buildServiceContent(order.package, order)
      if (!exist.servicesJson) {
        const sj = order.packageServicesJson || order.package?.servicesJson || order.package?.features || null
        if (sj) patch.servicesJson = sj
      }
    }

    const updated =
      Object.keys(patch).length > 0
        ? await prisma.contract.update({ where: { id: exist.id }, data: patch })
        : exist

    // 补齐时重新渲染 PDF（含公章 + 水印）
    if (Object.keys(patch).length > 0 || !updated.pdfUrl) {
      try {
        await renderContractPdf(updated.id)
      } catch (e) {
        console.error('[contract] re-render pdf failed', e instanceof Error ? e.stack : String(e))
      }
    }
    return prisma.contract.findUnique({ where: { id: updated.id }, include: { template: true } })
  }

  // 模板优先级：套餐指定模板 > 默认模板 > 第一个模板
  const template =
    (order.package?.templateId
      ? await prisma.contractTemplate.findUnique({ where: { id: order.package.templateId } })
      : null) ||
    (await prisma.contractTemplate.findFirst({ where: { isDefault: true } })) ||
    (await prisma.contractTemplate.findFirst({ orderBy: { id: 'asc' } }))
  if (!template) throw new Error('合同模板未配置，请联系顾问')

  // 签署前用「今天」预览；签署时以签署当天为准重算并落库
  const p = computeServicePeriod(new Date(), order.period, order.periodDays)
  const servicesJson = order.packageServicesJson || order.package?.servicesJson || order.package?.features || null

  const created = await prisma.contract.create({
    data: {
      orderId: order.id,
      templateId: template.id,
      contractNo: await generateBizNo('contract', memberUserId),
      partyAName: order.name,
      partyAPhone: order.phone,
      partyACompany: order.company || null,
      serviceContent: buildServiceContent(order.package, order),
      servicesJson,
      amount: order.amount,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      serviceDays: p.days,
      periodText: p.periodText,
      status: 'PENDING',
    },
  })

  // 立即渲染未签名 PDF（公章 + 水印），PDF 生成失败不影响下单主流程
  try {
    await renderContractPdf(created.id)
  } catch (e) {
    console.error('[contract] pre-render pdf failed', e instanceof Error ? e.stack : String(e))
  }

  return prisma.contract.findUnique({ where: { id: created.id }, include: { template: true } })
}

/** 会员 → 合同实名信息（认证姓名 + 脱敏身份证） */
export function memberRealInfo(member: {
  isRealVerified?: boolean
  realName?: string | null
  idCardNoEncrypted?: string | null
} | null): { realName?: string | null; idCardMasked?: string | null } {
  if (!member || !member.isRealVerified) return {}
  const masked = member.idCardNoEncrypted ? maskIdCard(decryptIdCard(member.idCardNoEncrypted)) : ''
  return { realName: member.realName, idCardMasked: masked || null }
}

/** 合同正文渲染成纯文本段落（小程序原生滚动阅读） */
export function contractText(
  contract: {
    serviceContent: string
    servicesJson?: string | null
    terms?: string | null
    partyAName: string
    partyAPhone: string
    partyACompany?: string | null
    amount: number
    periodStart?: string | null
    periodEnd?: string | null
    serviceDays?: number | null
    periodText?: string | null
  },
  template?: { contentHtml?: string | null; partyBName?: string | null } | null,
  real?: { realName?: string | null; idCardMasked?: string | null }
): string[] {
  const raw = template?.contentHtml || ''
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|section)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const data = buildContractData(contract, template, real)
  let out = text
  for (const [k, v] of Object.entries(data)) out = out.split(`{{${k}}}`).join(v || '')
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 「2026年09月28日 至 2026年10月28日，共31天」 */
export function contractPeriodRange(contract: {
  periodStart?: string | null
  periodEnd?: string | null
  serviceDays?: number | null
}): string {
  if (!contract.periodStart || !contract.periodEnd) return ''
  return `${contract.periodStart} 至 ${contract.periodEnd}，共${contract.serviceDays || 31}天`
}

export const CONTRACT_STATUS_TEXT: Record<string, string> = {
  PENDING: '待签署',
  SIGNED: '已签署',
  VOID: '已作废',
}

export function contractStatusText(status: string): string {
  return CONTRACT_STATUS_TEXT[status] || status
}
