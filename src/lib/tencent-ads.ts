import { prisma } from '@/lib/db'

/**
 * 腾讯广告转化回传
 * 用户留资/下单后，自动标记转化
 */
export async function trackConversion(params: {
  clickid: string
  event: 'LEAD' | 'ORDER'
  traceId: string
}) {
  const { clickid, event, traceId } = params
  if (!clickid) return

  try {
    await prisma.adClick.updateMany({
      where: { clickid },
      data: {
        isConverted: true,
        convertedAt: new Date(),
        ...(event === 'ORDER' ? { isOrdered: true } : {}),
      },
    })
  } catch (e) {
    console.error('[tencent-ads] 转化回传失败:', e)
  }
}
