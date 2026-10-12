import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

type ImgProps = {
  src?: string | null
  alt: string
  className?: string
}

export function CardImage({ src, alt, className }: ImgProps) {
  return (
    <div className={cn('relative overflow-hidden bg-mist', className)}>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[80%] rotate-[-28deg] select-none">
              {Array.from({ length: 40 }).map((_, i) => (
                <span key={i} className="mb-10 mr-8 inline-block whitespace-nowrap text-[11px] font-medium tracking-wider text-white/40">
                  闪途网络
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-mist">
          <span className="text-xs tracking-widest text-brand-300">SHANTU</span>
        </div>
      )}
    </div>
  )
}

export function ServiceCard({
  slug,
  name,
  enName,
  summary,
  index,
}: {
  slug: string
  name: string
  enName?: string | null
  summary: string
  index: number
}) {
  return (
    <Link
      href={`/services/${slug}`}
      className="card card-hover group flex h-full flex-col p-6"
    >
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-semibold tabular-nums text-brand-300">
          {String(index + 1).padStart(2, '0')}
        </span>
        {enName ? (
          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">{enName}</span>
        ) : null}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{name}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{summary}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
        查看详情 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

export function CaseCard({
  slug,
  title,
  industry,
  projectType,
  cover,
  summary,
}: {
  slug: string
  title: string
  industry?: string | null
  projectType?: string | null
  cover?: string | null
  summary?: string | null
}) {
  return (
    <Link href={`/cases/${slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
      <CardImage src={cover} alt={title} className="aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {industry ? <span className="chip">{industry}</span> : null}
          {projectType ? <span className="chip">{projectType}</span> : null}
        </div>
        <h3 className="mt-3 text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
        {summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{summary}</p>
        ) : null}
      </div>
    </Link>
  )
}

export function ArticleCard({
  slug,
  title,
  summary,
  cover,
  publishedAt,
  categoryName,
}: {
  slug: string
  title: string
  summary?: string | null
  cover?: string | null
  publishedAt?: Date | string | null
  categoryName?: string | null
}) {
  return (
    <Link href={`/blog/${slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
      <CardImage src={cover} alt={title} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {categoryName ? <span className="chip">{categoryName}</span> : null}
          <span>{formatDate(publishedAt)}</span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
        {summary ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{summary}</p> : null}
      </div>
    </Link>
  )
}
