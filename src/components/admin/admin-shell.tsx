'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ToastProvider } from './toast'
import {
  BarChart3,
  LayoutDashboard,
  Users,
  Briefcase,
  Grid3x3,
  FileText,
  Image as ImageIcon,
  Images,
  ListChecks,
  MessageSquare,
  Package,
  Ticket,
  Receipt,
  CreditCard,
  Settings,
  Shield,
  IdCard,
  UsersRound,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Trash2,
  ScrollText,
  History,
  Search,
  ChevronDown,
  Sparkles,
  Bell,
  Droplets,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PermissionKey } from '@/lib/auth'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  perm: PermissionKey
}

type NavGroup = {
  title: string
  icon: typeof LayoutDashboard
  items: NavItem[]
}

const GROUPS: NavGroup[] = [
  {
    title: '业务核心',
    icon: LayoutDashboard,
    items: [
      { href: '/admin', label: '工作台', icon: LayoutDashboard, perm: 'dashboard' },
      { href: '/admin/leads', label: '客户线索', icon: Users, perm: 'leads' },
      { href: '/admin/members', label: '会员管理', icon: UsersRound, perm: 'members' },
      { href: '/admin/orders', label: '订单管理', icon: Receipt, perm: 'orders' },
      { href: '/admin/projects', label: '项目管理', icon: FolderKanban, perm: 'projects' },
    ],
  },
  {
    title: '内容运营',
    icon: FileText,
    items: [
      { href: '/admin/cases', label: '案例管理', icon: Briefcase, perm: 'cases' },
      { href: '/admin/services', label: '服务管理', icon: Grid3x3, perm: 'services' },
      { href: '/admin/articles', label: '文章管理', icon: FileText, perm: 'articles' },
      { href: '/admin/banners', label: 'Banner 管理', icon: Images, perm: 'banners' },
      { href: '/admin/packages', label: '套餐管理', icon: Package, perm: 'packages' },
      { href: '/admin/service-types', label: '服务类型', icon: Grid3x3, perm: 'packages' },
    ],
  },
  {
    title: '产品与合同',
    icon: ScrollText,
    items: [
      { href: '/admin/coupons', label: '优惠码', icon: Ticket, perm: 'packages' },
      { href: '/admin/contracts', label: '合同管理', icon: FileText, perm: 'packages' },
      { href: '/admin/contract-templates', label: '合同模板', icon: FileText, perm: 'packages' },
      { href: '/admin/media', label: '素材库', icon: ImageIcon, perm: 'media' },
      { href: '/admin/forms', label: '表单管理', icon: ListChecks, perm: 'forms' },
    ],
  },
  {
    title: '系统',
    icon: Settings,
    items: [
      { href: '/admin/payment', label: '支付设置', icon: CreditCard, perm: 'payment' },
      { href: '/admin/settings', label: '网站设置', icon: Settings, perm: 'settings' },
      { href: '/admin/wechat', label: '小程序设置', icon: MessageSquare, perm: 'wechat' },
      { href: '/admin/realname-config', label: '实名认证配置', icon: IdCard, perm: 'settings' },
      { href: '/admin/watermark', label: '水印设置', icon: Droplets, perm: 'settings' },
      { href: '/admin/ai-config', label: 'AI 配置', icon: Sparkles, perm: 'settings' },
      { href: '/admin/admins', label: '管理员', icon: Shield, perm: 'admins' },
      { href: '/admin/recycle', label: '回收站', icon: Trash2, perm: 'recycle' },
      { href: '/admin/login-logs', label: '登录日志', icon: ScrollText, perm: 'logs' },
      { href: '/admin/operation-logs', label: '操作日志', icon: History, perm: 'logs' },
      { href: '/admin/ad-stats', label: '广告监测', icon: BarChart3, perm: 'dashboard' },
      { href: '/admin/visits', label: '访问分析', icon: Activity, perm: 'dashboard' },
    ],
  },
]

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  OPERATOR: '运营人员',
  SALES: '销售人员',
}

function allowedPerms(role: string): string[] {
  if (role === 'SUPER_ADMIN') return []
  if (role === 'SALES') return ['dashboard', 'leads', 'members', 'orders']
  return [
    'dashboard',
    'cases',
    'services',
    'articles',
    'banners',
    'media',
    'forms',
    'packages',
    'orders',
    'members',
    'projects',
  ]
}

// 反查 href -> label
const LABEL_MAP: Record<string, string> = {}
GROUPS.forEach((g) => g.items.forEach((i) => (LABEL_MAP[i.href] = i.label)))

export function AdminShell({
  children,
  adminName,
  adminRole,
  logoUrl = '',
}: {
  children: ReactNode
  adminName: string
  adminRole: string
  logoUrl?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  // 侧边栏固定展开（已移除收起菜单功能）
  const collapsed = false
  const [keyword, setKeyword] = useState('')
  const [tabs, setTabs] = useState<{ href: string; label: string }[]>([
    { href: '/admin', label: '工作台' },
  ])
  // 分组折叠：默认展开"业务核心"
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('admin-open-groups')
      if (saved) return JSON.parse(saved)
    } catch {}
    return { '业务核心': true }
  })

  function toggleGroup(title: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem('admin-open-groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // 路由变化 → 自动加入标签
  useEffect(() => {
    const label = LABEL_MAP[pathname]
    if (!label) return
    setTabs((prev) => {
      if (prev.find((t) => t.href === pathname)) return prev
      return [...prev, { href: pathname, label }]
    })
  }, [pathname])

  function closeTab(href: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.href === href)
      const next = prev.filter((t) => t.href !== href)
      if (pathname === href && next.length > 0) {
        const fallback = next[Math.max(0, idx - 1)] || next[0]
        router.push(fallback.href)
      }
      return next.length ? next : [{ href: '/admin', label: '工作台' }]
    })
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  // 角色过滤 + 搜索过滤
  const groups = useMemo(() => {
    const perms = allowedPerms(adminRole)
    const kw = keyword.trim().toLowerCase()
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const roleOk = adminRole === 'SUPER_ADMIN' || perms.includes(item.perm)
        if (!roleOk) return false
        if (!kw) return true
        return item.label.toLowerCase().includes(kw)
      }),
    })).filter((g) => g.items.length > 0)
  }, [adminRole, keyword])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F6FA' }}>
      {/* 侧边栏 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 transform border-r transition-all duration-200 lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60',
          mobileOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full',
        )}
        style={{ background: '#FFFFFF', borderColor: '#E8ECF2' }}
      >
        <div
          className={cn('flex h-14 items-center gap-2 px-4 border-b', collapsed && 'lg:justify-center lg:px-0')}
          style={{ borderColor: '#E8ECF2' }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#3B6EF5,#6B9BFF)' }}
          >
            闪
          </span>
          {!collapsed && <span className="text-[15px] font-bold" style={{ color: '#1E2A3B' }}>闪途管理</span>}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden"
            style={{ color: '#9AA7B8' }}
            aria-label="关闭菜单"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 搜索框 */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: '#9AA7B8' }} />
              <input
                className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
                style={{ borderColor: '#E8ECF2', background: '#F4F6FA', color: '#1E2A3B' }}
                placeholder="搜索菜单…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
        )}

        <nav className="space-y-0.5 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          {groups.map((group) => {
            const GroupIcon = group.icon
            return (
              <div key={group.title} className="mb-1">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="flex w-full items-center gap-1.5 rounded px-3 pt-2 pb-1 text-left text-[11px] tracking-wider transition hover:bg-slate-50"
                    style={{ color: '#9AA7B8' }}
                  >
                    <GroupIcon className="h-3 w-3" />
                    <span className="flex-1">{group.title}</span>
                    <svg className={cn('h-3 w-3 transition-transform', openGroups[group.title] !== false ? 'rotate-0' : '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                )}
                {collapsed && <div className="mx-auto my-2 h-px w-8" style={{ background: '#E8ECF2' }} />}
                {(!collapsed && openGroups[group.title] !== false) && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg py-2 text-[13px] transition',
                          collapsed ? 'lg:justify-center lg:px-0' : 'px-3',
                          active ? 'font-medium' : '',
                        )}
                        style={{
                          background: active ? '#EAF1FE' : 'transparent',
                          color: active ? '#3B6EF5' : '#5B6B82',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) (e.currentTarget as HTMLElement).style.background = '#F4F6FA'
                        }}
                        onMouseLeave={(e) => {
                          if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-xs" style={{ color: '#9AA7B8' }}>未找到匹配菜单</p>
          )}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,.4)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* 主区域 */}
      <div className={cn(collapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        {/* 顶栏 */}
        <header
          className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b px-3"
          style={{ background: '#FFFFFF', borderColor: '#E8ECF2' }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg lg:hidden"
            style={{ color: '#5B6B82' }}
            aria-label="打开菜单"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* 多标签栏 */}
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {tabs.map((t) => {
              const active = pathname === t.href
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    'relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition',
                  )}
                  style={{
                    background: active ? '#F4F6FA' : 'transparent',
                    color: active ? '#3B6EF5' : '#5B6B82',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {t.label}
                  {tabs.length > 1 && (
                    <span
                      onClick={(e) => closeTab(t.href, e)}
                      className="flex h-4 w-4 items-center justify-center rounded hover:bg-black/10"
                      style={{ fontSize: 12, lineHeight: 1 }}
                    >
                      ×
                    </span>
                  )}
                  {active && (
                    <span
                      className="absolute left-2 right-2 -bottom-[1px] h-0.5 rounded"
                      style={{ background: '#3B6EF5' }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href="/admin/ai-config"
              title="AI 配置"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-purple-50"
              style={{ color: '#7C6FF0' }}
            >
              <Sparkles className="h-4 w-4" />
            </Link>
            <button className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100" style={{ color: '#5B6B82' }} title="消息">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: '#E5544B' }} />
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-[13px] font-medium" style={{ color: '#1E2A3B' }}>{adminName}</div>
              <div className="text-[11px]" style={{ color: '#9AA7B8' }}>{ROLE_LABEL[adminRole] || adminRole}</div>
            </div>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg,#6B9BFF,#9B7BFF)' }}
            >
              {adminName.slice(0, 1)}
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-red-200 hover:text-red-600"
              style={{ borderColor: '#E8ECF2', color: '#5B6B82' }}
            >
              <LogOut className="h-3.5 w-3.5" /> 退出
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-6" style={{ color: '#1E2A3B' }}>
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  )
}
