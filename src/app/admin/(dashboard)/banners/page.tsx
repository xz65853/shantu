import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { BannerManager, type BannerRow } from '@/components/admin/banner-manager'

export const dynamic = 'force-dynamic'

export default async function AdminBannersPage() {
  await requirePermission('banners')
  const banners = await prisma.banner.findMany({ orderBy: [{ sort: 'asc' }, { id: 'desc' }] })

  const rows: BannerRow[] = banners.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    image: b.image,
    buttonText: b.buttonText,
    buttonLink: b.buttonLink,
    sort: b.sort,
    isActive: b.isActive,
    startAt: b.startAt ? b.startAt.toISOString() : null,
    endAt: b.endAt ? b.endAt.toISOString() : null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="Banner 管理" desc="首页轮播图，可设置上下线时间与跳转链接。" />
      <BannerManager rows={rows} />
    </div>
  )
}
