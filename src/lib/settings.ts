import { prisma } from './db'

export const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: '桃江闪途网络科技工作室（个体工商户）',
  site_slogan: '实体企业线上增长服务商',
  site_desc: '抖音代运营｜短视频｜直播｜本地生活｜广告投放，为实体企业提供从内容到获客的一站式线上运营服务。',
  logo_text: '闪途',
  site_logo: '', // 站点 Logo 图片（素材库/网站设置里上传，留空用文字 Logo）
  contact_phone: '',
  contact_email: '',
  contact_address: '',
  wechat_qrcode: '',
  icp: '',
  douyin: '',
  xiaohongshu: '',
  seo_title: '桃江闪途网络科技工作室（个体工商户）｜实体企业线上增长服务商',
  seo_description:
    '桃江闪途网络科技工作室（个体工商户），专注抖音代运营、短视频运营、直播运营、本地生活、广告投放与电商运营，帮助实体企业把生意搬到线上。',
  seo_keywords: '抖音代运营,短视频运营,直播运营,本地生活运营,广告投放,桃江闪途网络科技工作室',
  footer_note: '帮助实体企业，把生意搬到线上。',
  // ===== 合同 PDF 水印（客户签署合同，防外传） =====
  cwm_enable: '1', // 总开关：1 开启 / 0 关闭
  cwm_template: '{name} {idcard4} {timestamp}', // 占位符 {name}=姓名 {idcard4}=身份证后4位 {timestamp}=生成时间
  cwm_font_size: '11', // 字号 px
  cwm_color: '#999999', // 颜色
  cwm_opacity: '0.5', // 不透明度 0~1
  cwm_rotate: '-30', // 旋转角度（度）
  cwm_gap_x: '300', // 横向间距 px
  cwm_gap_y: '250', // 纵向间距 px
  // ===== 小程序溯源水印（案例/日报/月报） =====
  watermark_enable: '1', // 总开关：1 开启 / 0 关闭
  watermark_template: '{name} {phone4} {date}', // 文案模板，占位符 {name} {phone4} {date}
  watermark_guest_text: '演示数据', // 未登录看案例时的水印文字
  watermark_opacity: '0.2', // 不透明度 0~1
  watermark_color: '#c0c0c0', // 颜色
  watermark_font_size: '12', // 字号 px
  watermark_gap_x: '300', // 横向间距 px（SVG 平铺单元宽）
  watermark_gap_y: '250', // 纵向间距 px（SVG 平铺单元高）
  watermark_rotate: '-30', // 旋转角度（度）
  // ===== 上传图片水印（管理后台上传案例/日报/月报图片时烧录，防盗图） =====
  upload_wm_enable: '1', // 总开关：1 开启 / 0 关闭
  upload_wm_text: '桃江闪途网络科技工作室', // 水印文字内容
  upload_wm_color: '#ffffff', // 水印颜色
  upload_wm_opacity: '0.38', // 不透明度 0~1
  upload_wm_font_size: '30', // 字号 px
  upload_wm_rotate: '-24', // 旋转角度（度）
  upload_wm_gap_x: '420', // 横向间距 px（SVG 平铺单元宽）
  upload_wm_gap_y: '240', // 纵向间距 px（SVG 平铺单元高）
  // ===== 文章/博客水印（防抄袭） =====
  article_wm_enable: '1', // 1 开启 / 0 关闭
  article_wm_text: '桃江闪途 · 原创', // 固定文案
  // ===== 素材库水印（仅后台查看） =====
  media_wm_enable: '1', // 1 开启 / 0 关闭
  media_wm_template: '内部资料 · {operator} {time}', // {operator}=操作人 {time}=时间
  // ===== 订单详情/对账单水印（可选，财务数据） =====
  order_wm_enable: '0', // 默认关闭，后台可开
  // ===== 会员实名身份证水印（仅后台查看） =====
  realname_wm_enable: '1', // 1 开启 / 0 关闭，身份证图上打「仅供核对」
  realname_wm_text: '仅供核对',
  // ===== 网站维护模式（前台官网维护开关） =====
  maintenance_enable: '0', // 1 开启 / 0 关闭
  maintenance_reason: '网站升级维护中，预计 24 小时内恢复', // 维护原因文案（多行）
  maintenance_resume_at: '', // 预计恢复时间（选填）
}

export async function getSettings(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.siteSetting.findMany()
    const map: Record<string, string> = { ...DEFAULT_SETTINGS }
    for (const row of rows) {
      map[row.key] = row.value ?? ''
    }
    return map
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function getSetting(key: string) {
  const all = await getSettings()
  return all[key] ?? ''
}

export async function saveSettings(values: Record<string, string>) {
  const entries = Object.entries(values)
  for (const [key, value] of entries) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  }
}
