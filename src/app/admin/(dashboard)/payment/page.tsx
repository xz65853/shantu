import { requirePermission } from '@/lib/auth'
import { getPaymentSettings } from '@/lib/payment-settings'
import { PageHeader } from '@/components/admin/page-header'
import { PaymentSettingsForm } from '@/components/admin/payment-settings-form'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentPage() {
  await requirePermission('payment')
  const settings = await getPaymentSettings()

  return (
    <div className="space-y-6">
      <PageHeader
        title="支付设置"
        desc="配置前台套餐下单后可用的支付方式。真实微信/支付宝支付需要已备案域名、HTTPS 与商户号。"
      />
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
        当前阶段说明：微信与支付宝的<b>线上直付</b>（下单即唤起支付）需要备案域名 + HTTPS + 商户号，
        域名证书就绪后可在「小程序设置 → 微信支付」填写商户配置并接通。
        现在可先上传<b>收款码</b>，用户扫码后你核对到账、在订单管理里改为「已支付」即可，流程同样完整。
      </div>
      <PaymentSettingsForm initial={settings} />
    </div>
  )
}
