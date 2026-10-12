import { requirePermission } from '@/lib/auth'
import { getWechatSettings, getWechatSettingsMasked } from '@/lib/wechat-settings'
import { WECHAT_SECRET_KEYS } from '@/lib/wechat-fields'
import { PageHeader } from '@/components/admin/page-header'
import { WechatSettingsForm } from '@/components/admin/wechat-settings-form'

export const dynamic = 'force-dynamic'

export default async function AdminWechatPage() {
  await requirePermission('wechat')
  const settings = await getWechatSettingsMasked()
  const raw = await getWechatSettings()

  const configured: Record<string, boolean> = {}
  for (const key of WECHAT_SECRET_KEYS) configured[key] = Boolean(raw[key])

  return (
    <div className="space-y-6">
      <PageHeader
        title="小程序设置"
        desc="微信小程序基本信息、微信支付配置与接口域名统一在此维护。AppSecret、API v3 密钥、商户私钥加密存储，保存后不再显示明文。"
      />
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-700">
        说明：本模块只做<b>配置管理</b>（存 AppID、商户号、密钥、回调地址等）。
        微信登录、下单支付、退款等接口调用属于交易流程，需在小程序端与后端接口另行开发，不在当前范围内。
      </div>
      <WechatSettingsForm initial={settings} configured={configured} />
    </div>
  )
}
