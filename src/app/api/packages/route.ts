import { handle, ok } from '@/lib/api'
import { prisma } from '@/lib/db'

/** 前台：获取上架套餐 + SKU 规格 + 最低价（价格单位：分） */
export async function GET() {
  return handle(async () => {
    const list = await prisma.package.findMany({
      where: { status: 1 },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: {
        skus: { where: { status: 1 }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
      },
    })
    return ok(
      list.map((p) => {
        const skus = p.skus
        const prices = skus.map((s) => s.price)
        return {
          ...p,
          features: parseFeatures(p.features),
          skus: skus.map((s) => ({
            id: s.id,
            name: s.name,
            price: s.price,
            originalPrice: s.originalPrice,
            serviceDays: s.serviceDays,
            features: parseFeatures(s.features),
          })),
          // 最低价：有上架 SKU 取最低，否则回退套餐自身价格
          minPrice: prices.length ? Math.min(...prices) : p.price,
        }
      }),
    )
  })
}

function parseFeatures(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
