import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMetadata } from '@/lib/seo'
import { PayClient } from '@/components/pay-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '订单支付',
    description: '闪途服务订单支付',
    path: '/pay',
    noindex: true,
  })
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>
  searchParams: Promise<{ tail?: string }>
}) {
  const { orderNo } = await params
  const { tail } = await searchParams

  return (
    <section className="bg-mist py-16 sm:py-20">
      <div className="container-page max-w-2xl">
        <Link href="/pricing" className="text-sm text-slate-500 hover:text-brand-600">
          ← 返回套餐
        </Link>
        <PayClient orderNo={orderNo} tail={tail || ''} />
      </div>
    </section>
  )
}
