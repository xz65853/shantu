'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CaseCard } from './cards'

export type CaseItem = {
  id: number
  title: string
  slug: string
  industry: string | null
  projectType: string | null
  cover: string | null
  summary: string | null
  categoryId: number | null
}

export function CaseFilter({
  items,
  categories,
}: {
  items: CaseItem[]
  categories: { id: number; name: string; slug: string }[]
}) {
  const [active, setActive] = useState<number | 'all'>('all')

  const filtered = active === 'all' ? items : items.filter((i) => i.categoryId === active)

  return (
    <div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:justify-center sm:px-0">
        <button
          type="button"
          onClick={() => setActive('all')}
          className={cn(
            'shrink-0 rounded-full border px-4 py-1.5 text-sm transition',
            active === 'all'
              ? 'border-ink bg-ink text-white'
              : 'border-line text-slate-600 hover:border-brand-300',
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActive(cat.id)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-sm transition',
              active === cat.id
                ? 'border-ink bg-ink text-white'
                : 'border-line text-slate-600 hover:border-brand-300',
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line py-16 text-center text-sm text-slate-400">
          该分类下暂无公开案例
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <CaseCard
              key={item.id}
              slug={item.slug}
              title={item.title}
              industry={item.industry}
              projectType={item.projectType}
              cover={item.cover}
              summary={item.summary}
            />
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <Link href="/cases" className="btn-outline">
          查看全部案例
        </Link>
      </div>
    </div>
  )
}
