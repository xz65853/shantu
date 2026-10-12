'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

export type BannerItem = {
  id: number
  title: string
  subtitle: string | null
  image: string | null
  buttonText: string | null
  buttonLink: string | null
}

export function BannerCarousel({ items }: { items: BannerItem[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [items.length])

  if (items.length === 0) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-ink">
      <div className="relative aspect-[21/9] w-full sm:aspect-[24/8]">
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/60 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="container-page">
                <div className="max-w-lg text-white">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{item.title}</h2>
                  {item.subtitle ? (
                    <p className="mt-2 text-sm leading-relaxed text-white/75">{item.subtitle}</p>
                  ) : null}
                  {item.buttonText ? (
                    <Link
                      href={item.buttonLink || '/contact'}
                      className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-white/90"
                    >
                      {item.buttonText}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`切换到第 ${i + 1} 张`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
