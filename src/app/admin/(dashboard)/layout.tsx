import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { AdminShell } from '@/components/admin/admin-shell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [admin, settings] = await Promise.all([
    requireAdmin(),
    getSettings().catch(() => ({}) as Record<string, string>),
  ])
  return (
    <AdminShell adminName={admin.name} adminRole={admin.role} logoUrl={settings.site_logo}>
      {children}
    </AdminShell>
  )
}
