export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: number | string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          accent ? 'text-brand-600' : 'text-ink'
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-slate-400">{hint}</div> : null}
    </div>
  )
}
