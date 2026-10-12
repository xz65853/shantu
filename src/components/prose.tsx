export function Lines({ text, className = '' }: { text?: string | null; className?: string }) {
  if (!text) return null

  // 检测是否包含HTML表格，如果有就直接渲染HTML
  if (text.includes('<table')) {
    return (
      <div
        className={`prose-table ${className}`}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    )
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  return (
    <div className={`space-y-3 ${className}`}>
      {lines.map((line, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-slate-600">
          {line}
        </p>
      ))}
    </div>
  )
}

export function BulletLines({ text }: { text?: string | null }) {
  if (!text) return null
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-slate-600">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          {line}
        </li>
      ))}
    </ul>
  )
}
