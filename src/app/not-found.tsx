import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="text-[13px] font-semibold tracking-[0.2em] text-brand-300">404</span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">页面不存在</h1>
      <p className="mt-3 text-sm text-slate-500">你访问的页面可能已被移动或删除。</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-primary">
          返回首页
        </Link>
        <Link href="/contact" className="btn-outline">
          联系我们
        </Link>
      </div>
    </div>
  )
}
