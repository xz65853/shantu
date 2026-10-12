import { fullUrl } from "@/lib/full-url"
import { handle, ok } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { getPaymentSettings } from '@/lib/payment-settings'
import { getWechatSettings } from '@/lib/wechat-settings'
import {
  getPublishedPackages,
  getPublishedServices,
  getPublishedCases,
  getPublishedArticles,
  parsePackageFeatures,
} from '@/lib/queries'

/**
 * 小程序首页聚合接口：一次返回服务、案例、套餐、文章与站点信息
 * 首页文案（标题/公告/标签等）在后台「小程序设置 → 小程序首页内容」维护，
 * 保存后小程序端下次请求即生效。
 * 只返回已发布内容，不含任何敏感字段
 */
export async function GET() {
  return handle(async () => {
    const [settings, wx, services, cases, packages, articles, pay] = await Promise.all([
      getSettings(),
      getWechatSettings(),
      getPublishedServices(),
      getPublishedCases({ take: 6 }),
      getPublishedPackages(),
      getPublishedArticles({ take: 4 }),
      getPaymentSettings(),
    ])

    const badges = (wx.wxapp_home_badges || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    return ok({
      site: {
        name: settings.site_name,
        slogan: settings.site_slogan,
        desc: settings.site_desc || settings.seo_description,
        phone: settings.contact_phone,
        address: settings.contact_address,
        email: settings.contact_email,
        icp: settings.icp,
        wechatQrcode: fullUrl(settings.wechat_qrcode) || '',
      },
      // 后台可配置的首页内容
      home: {
        title: wx.wxapp_home_title || '把生意搬到线上',
        subtitle: wx.wxapp_home_subtitle || settings.site_slogan || '实体企业线上增长服务商',
        notice: wx.wxapp_home_notice || '',
        badges,
        buttonText: wx.wxapp_home_button_text || '免费获取运营方案',
        qrcode: fullUrl(wx.wxapp_home_qrcode) || '',
        showCases: wx.wxapp_show_cases !== '0',
        showArticles: wx.wxapp_show_articles !== '0',
        showPackages: wx.wxapp_show_packages !== '0',
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        enName: s.enName,
        summary: s.summary,
      })),
      cases: cases.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        industry: c.industry,
        projectType: c.projectType,
        cover: fullUrl(c.cover),
        summary: c.summary,
      })),
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        period: p.period,
        price: p.price,
        originalPrice: p.originalPrice,
        summary: p.summary,
        features: parsePackageFeatures(p.features),
        recommended: p.recommended,
      })),
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        cover: fullUrl(a.cover),
        publishedAt: a.publishedAt,
      })),
      payment: {
        wechat: pay.pay_wechat_enable === '1',
        alipay: pay.pay_alipay_enable === '1',
        offline: pay.pay_offline_enable === '1',
      },
    })
  })
}
