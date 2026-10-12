import type { ReactNode } from 'react'
import { Reveal } from './reveal'

export function SectionHeading({
  eyebrow,
  title,
  desc,
  center = true,
}: {
  eyebrow?: string
  title: string
  desc?: string
  center?: boolean
}) {
  return (
    <Reveal>
      <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
        {eyebrow ? (
          <div className={center ? 'flex justify-center' : ''}>
            <span className="eyebrow">{eyebrow}</span>
          </div>
        ) : null}
        <h2 className={`section-title ${eyebrow ? 'mt-3' : ''} text-balance`}>{title}</h2>
        {desc ? <p className={`section-sub ${center ? 'mx-auto' : ''}`}>{desc}</p> : null}
      </div>
    </Reveal>
  )
}

export function Section({
  children,
  className = '',
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={`py-16 sm:py-20 lg:py-24 ${className}`}>
      <div className="container-page">{children}</div>
    </section>
  )
}
