import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { WatermarkConfig } from '@/components/admin/watermark-config'

export const dynamic = 'force-dynamic'

/**
 * 水印设置
 * 路由：/admin/watermark
 * 分两类独立配置：合同 PDF 水印、小程序水印；另含文章/素材库/订单/实名水印开关。
 * 保存后即时生效（存 site_settings，运行中读取，无需重启）。
 */
export default async function AdminWatermarkPage() {
  await requirePermission('settings')

  return (
    <div className="space-y-6">
      <PageHeader
        title="水印设置"
        desc="配置合同 PDF 与小程序各页面的溯源水印。改字号、颜色、透明度右侧实时预览，保存后立即生效，无需重启。"
      />
      <WatermarkConfig />
    </div>
  )
}
