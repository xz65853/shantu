'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X, Phone, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

type MemberInfo = {
  id: number
  userId?: string | null
  phone?: string | null
  name?: string | null
  nickname?: string | null
}

const NAV = [
  { href: '/', label: '首页' },
  { href: '/services', label: '服务' },
  { href: '/cases', label: '案例' },
  { href: '/pricing', label: '套餐价格' },
  { href: '/blog', label: '运营干货' },
  { href: '/about', label: '关于我们' },
  { href: '/contact', label: '联系我们' },
]

export function SiteHeader({
  siteName = '桃江闪途网络科技工作室（个体工商户）',
  logoText = '闪途',
  logoUrl = '',
  phone = '',
}: {
  siteName?: string
  logoText?: string
  logoUrl?: string
  phone?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [member, setMember] = useState<MemberInfo | null>(null)

  useEffect(() => {
    fetch('/api/auth/member/me')
      .then((r) => r.json())
      .then((j) => setMember(j?.data || null))
      .catch(() => {})
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/member/logout', { method: 'POST' }).catch(() => {})
    setMember(null)
    router.refresh()
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b transition-all duration-300',
        scrolled ? 'border-line bg-white/90 backdrop-blur-md' : 'border-transparent bg-white',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label={siteName}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={logoText} className="h-9 w-auto rounded-lg object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-[13px] font-bold text-white">
              闪途
            </span>
          )}
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-ink">{logoText}</span>
            <span className="hidden text-[11px] text-slate-400 sm:block">实体企业线上增长服务商</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative rounded-md px-3 py-2 text-sm transition-colors',
                isActive(item.href) ? 'text-brand-700' : 'text-slate-600 hover:text-ink',
              )}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded bg-brand-600" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {member ? (
            <div className="group relative hidden items-center gap-1.5 md:flex">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink"
              >
                <UserRound className="h-4 w-4 text-brand-600" />
                {member.name || member.nickname || member.phone}
              </button>
              <div className="invisible absolute right-0 top-full z-50 w-40 rounded-lg border border-line bg-white py-1 opacity-0 shadow-md transition group-hover:visible group-hover:opacity-100">
                {member.userId ? (
                  <div className="border-b border-line px-3 py-2 text-xs text-slate-400">
                    会员ID {member.userId}
                  </div>
                ) : null}
                <Link
                  href="/member"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-mist"
                >
                  会员中心
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-mist"
                >
                  退出登录
                </button>
              </div>
            </div>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="hidden items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink md:inline-flex"
            >
              <UserRound className="h-4 w-4 text-brand-600" />
              登录
            </Link>
          )}
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="hidden items-center gap-1.5 text-sm font-medium text-slate-600 md:flex"
            >
              <Phone className="h-4 w-4 text-brand-600" />
              {phone}
            </a>
          ) : null}
          <Link href="/contact#consult" className="btn-primary hidden sm:inline-flex">
            免费获取运营方案
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink lg:hidden"
            aria-label="打开菜单"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="container-page grid gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm',
                  isActive(item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-700',
                )}
              >
                {item.label}
              </Link>
            ))}
            {member ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2.5 text-left text-sm text-slate-700"
              >
                退出登录（{member.name || member.nickname || member.phone}）
              </button>
            ) : (
              <Link
                href={`/login?redirect=${encodeURIComponent(pathname)}`}
                className="rounded-lg px-3 py-2.5 text-sm text-brand-700"
              >
                会员登录
              </Link>
            )}
            <Link href="/contact#consult" className="btn-primary mt-2 w-full">
              免费获取运营方案
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
