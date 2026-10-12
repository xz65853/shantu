import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/admin/page-header'
import { MediaLibrary, type MediaItem } from '@/components/admin/media-library'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage() {
  await requirePermission('media')
  const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })

  const items: MediaItem[] = media.map((m) => ({
    id: m.id,
    filename: m.filename,
    url: m.url,
    mimeType: m.mimeType,
    size: m.size,
    folder: m.folder,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="媒体库" desc="统一管理案例图片、文章配图、Banner 与视频，上传时自动压缩为 WebP。" />
      <MediaLibrary items={items} />
    </div>
  )
}
