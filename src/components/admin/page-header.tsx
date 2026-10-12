import type { ReactNode } from 'react'

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {desc ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{desc}</p> : null}
      </div>
      {action}
    </div>
  )
}
