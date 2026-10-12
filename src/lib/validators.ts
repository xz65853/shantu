import { z } from 'zod'

export const leadCreateSchema = z.object({
  name: z.string().trim().max(30, '姓名过长').optional().default(''),
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, '请填写正确的 11 位手机号'),
  company: z.string().trim().max(80).optional().default(''),
  city: z.string().trim().max(40).optional().default(''),
  industry: z.string().trim().max(40).optional().default(''),
  requirements: z.array(z.string().max(40)).max(20).optional().default([]),
  message: z.string().trim().max(1000, '描述过长').optional().default(''),
  source: z.string().trim().max(60).optional().default('官网'),
  sourcePage: z.string().trim().max(120).optional().default(''),
  // 广告归因：小程序启动参数带下来的 clickid，用于回传腾讯广告
  clickid: z.string().trim().max(100).optional().default(''),
  adSource: z.string().trim().max(40).optional().default(''),
})

export const loginSchema = z.object({
  username: z.string().trim().min(1, '请输入账号').max(40),
  password: z.string().min(1, '请输入密码').max(80),
})

const contentStatus = z.enum(['DRAFT', 'PUBLISHED', 'OFFLINE'])

export const serviceSchema = z.object({
  name: z.string().trim().min(1, '请填写服务名称').max(60),
  slug: z.string().trim().min(1).max(80),
  enName: z.string().trim().max(60).optional().default(''),
  icon: z.string().trim().max(40).optional().default(''),
  summary: z.string().trim().min(1, '请填写服务简介').max(500),
  detail: z.string().max(20000).optional().default(''),
  process: z.string().max(20000).optional().default(''),
  target: z.string().max(20000).optional().default(''),
  faq: z.string().max(20000).optional().default(''),
  cover: z.string().max(500).optional().default(''),
  seoTitle: z.string().max(120).optional().default(''),
  seoDesc: z.string().max(300).optional().default(''),
  sort: z.coerce.number().int().default(0),
  status: contentStatus.default('PUBLISHED'),
  categoryId: z.coerce.number().int().nullable().optional(),
})

export const caseSchema = z.object({
  title: z.string().trim().min(1, '请填写案例标题').max(80),
  slug: z.string().trim().min(1).max(100),
  subtitle: z.string().max(160).optional().default(''),
  industry: z.string().max(40).optional().default(''),
  projectType: z.string().max(40).optional().default(''),
  clientName: z.string().max(80).optional().default(''),
  period: z.string().max(40).optional().default(''),
  cover: z.string().max(500).optional().default(''),
  summary: z.string().max(1000).optional().default(''),
  background: z.string().max(20000).optional().default(''),
  strategy: z.string().max(20000).optional().default(''),
  execution: z.string().max(20000).optional().default(''),
  result: z.string().max(20000).optional().default(''),
  metrics: z.string().max(4000).optional().default(''),
  showMetrics: z.boolean().optional().default(false),
  gallery: z.string().max(4000).optional().default(''),
  video: z.string().max(500).optional().default(''),
  seoTitle: z.string().max(120).optional().default(''),
  seoDesc: z.string().max(300).optional().default(''),
  isFeatured: z.boolean().optional().default(false),
  sort: z.coerce.number().int().default(0),
  status: contentStatus.default('PUBLISHED'),
  categoryId: z.coerce.number().int().nullable().optional(),
})

export const articleSchema = z.object({
  title: z.string().trim().min(1, '请填写文章标题').max(120),
  slug: z.string().trim().min(1).max(120),
  summary: z.string().max(500).optional().default(''),
  content: z.string().min(1, '请填写正文内容').max(100000),
  cover: z.string().max(500).optional().default(''),
  author: z.string().max(40).optional().default(''),
  seoTitle: z.string().max(120).optional().default(''),
  seoDesc: z.string().max(300).optional().default(''),
  status: contentStatus.default('PUBLISHED'),
  publishedAt: z.string().max(40).optional().nullable(),
  categoryId: z.coerce.number().int().nullable().optional(),
})

export const bannerSchema = z.object({
  title: z.string().trim().min(1, '请填写标题').max(80),
  subtitle: z.string().max(200).optional().default(''),
  image: z.string().max(500).optional().default(''),
  buttonText: z.string().max(30).optional().default(''),
  buttonLink: z.string().max(300).optional().default(''),
  sort: z.coerce.number().int().default(0),
  startAt: z.string().max(40).optional().nullable(),
  endAt: z.string().max(40).optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export const leadUpdateSchema = z.object({
  status: z
    .enum(['PENDING', 'CONTACTED', 'INTENTION', 'QUOTED', 'WON', 'HOLD', 'INVALID'])
    .optional(),
  assignedTo: z.coerce.number().int().nullable().optional(),
  note: z.string().max(2000).optional(),
})

export const followupSchema = z.object({
  content: z.string().trim().min(1, '请填写跟进内容').max(2000),
  nextFollowupAt: z.string().max(40).optional().nullable(),
})

export const adminSchema = z.object({
  username: z.string().trim().min(3, '账号至少 3 个字符').max(40),
  password: z.string().min(6, '密码至少 6 位').max(80).optional(),
  displayName: z.string().trim().min(1, '请填写姓名').max(40),
  phone: z.string().trim().max(20).optional().nullable(),
  remark: z.string().trim().max(200).optional().nullable(),
  role: z.enum(['SUPER_ADMIN', 'OPERATOR', 'SALES', 'FINANCE', 'READONLY']),
  isActive: z.boolean().optional().default(true),
})

export const formOptionSchema = z.object({
  group: z.enum(['industry', 'requirement']),
  label: z.string().trim().min(1, '请填写选项名称').max(40),
  value: z.string().trim().max(40).optional().default(''),
  sort: z.coerce.number().int().default(0),
  isActive: z.boolean().optional().default(true),
})

export const settingsSchema = z.record(z.string(), z.string().max(20000))

// ---------------- 套餐 / 订单 ----------------

/** 周期 → 服务天数（套餐后台选周期时给默认值） */
export function defaultPeriodDays(period: string): number {
  const p = (period || '').trim()
  const u = p.toUpperCase()
  if (u === 'YEAR' || p.includes('年')) return 372
  if (u === 'QUARTER' || p.includes('季')) return 93
  if (u === 'MONTH' || p.includes('月')) return 31
  if (u === 'DAY' || p.includes('日') || p.includes('一次性') || p.includes('单次') || p.includes('次')) return 1
  return 31
}

export const skuSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, '请填写规格名称').max(40),
  price: z.coerce.number().min(0.01, '价格最低 0.01 元'),
  originalPrice: z.coerce.number().min(0).optional().nullable(),
  serviceDays: z.coerce.number().int().min(1, '服务天数至少 1 天').max(999).default(31),
  features: z.array(z.string().max(80)).max(30).optional(),
  sort: z.coerce.number().int().default(0),
  status: z.coerce.number().int().min(0).max(1).default(1),
})

export const packageSchema = z.object({
  name: z.string().trim().min(1, '请填写套餐名称').max(60),
  slug: z
    .string()
    .trim()
    .min(1, '请填写标识')
    .max(60)
    .regex(/^[a-z0-9-]+$/, '标识只能使用小写字母、数字和短横线'),
  period: z.string().trim().min(1, '请填写周期').max(20),
  periodDays: z.coerce.number().int().min(1, '服务天数至少 1 天').max(999).optional(),
  price: z.coerce.number().min(0.01, '价格最低 0.01 元'),
  originalPrice: z.coerce.number().min(0).optional().nullable(),
  summary: z.string().trim().max(255).optional().default(''),
  cover: z.string().max(500).optional().default(''),
  skus: z.array(skuSchema).max(20).optional(),
  features: z.array(z.string().max(80)).max(30).optional().default([]),
  servicesJson: z.array(z.string().max(80)).max(30).optional(),
  recommended: z.boolean().optional().default(false),
  status: z.coerce.number().int().min(0).max(1).optional().default(1),
  sort: z.coerce.number().int().optional().default(0),
  templateId: z.coerce.number().int().positive().optional().nullable(),
  serviceTypeId: z.coerce.number().int().positive().optional().nullable(),
})

/** 前台下单 */
export const orderCreateSchema = z.object({
  packageId: z.coerce.number().int().positive('请选择套餐'),
  // 已登录会员可不填，服务端回填会员资料
  name: z.string().trim().max(30).optional().default(''),
  phone: z
    .string()
    .trim()
    .min(6, '请填写正确的手机号')
    .max(20, '手机号过长')
    .regex(/^[0-9+\-\s()]+$/, '手机号格式不正确'),
  company: z.string().trim().max(80).optional().default(''),
  city: z.string().trim().max(40).optional().default(''),
  industry: z.string().trim().max(40).optional().default(''),
  remark: z.string().trim().max(1000, '备注过长').optional().default(''),
  couponCode: z.string().trim().max(40).optional().default(''),
  source: z.string().trim().max(60).optional().default('官网套餐页'),
})

export const orderUpdateSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']).optional(),
  payMethod: z.enum(['WECHAT', 'ALIPAY', 'OFFLINE']).optional().nullable(),
  transactionId: z.string().trim().max(80).optional().default(''),
  adminRemark: z.string().trim().max(2000).optional().default(''),
})
