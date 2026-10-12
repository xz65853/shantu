'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Grid3x3, Briefcase, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/', label: '首页', icon: Home },
  { href: '/services', label: '服务', icon: Grid3x3 },
  { href: '/cases', label: '案例', icon: Briefcase },
  { href: '/contact', label: '咨询', icon: MessageSquare, highlight: true },
]

export function MobileTabbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md lg:hidden">
      <div className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors',
                item.highlight
                  ? active
                    ? 'text-white'
                    : 'text-brand-700'
                  : active
                    ? 'text-brand-700'
                    : 'text-slate-500',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full',
                  item.highlight ? 'bg-brand-600 text-white' : 'bg-transparent',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
