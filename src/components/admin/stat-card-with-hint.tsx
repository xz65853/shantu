"use client"

import { useState, useRef, useEffect } from "react"
import { HelpCircle, Loader2 } from "lucide-react"

export function StatCardWithHint({ label, value, color, bar, icon, context }: {
  label: string
  value: number
  color: string
  bar: number
  icon: string
  context: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout>>()

  async function fetchHint() {
    if (hint || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/ai/gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: "dashboard_brief",
          data: { metric: label, value, context },
        }),
      })
      const json = await res.json()
      if (json.code === 0) setHint(json.content || "暂无分析")
      else setHint(json.message || "暂不可用")
    } catch {
      setHint("网络错误")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border p-4" style={{ background: "#fff", borderColor: "#E8ECF2" }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1 text-xs" style={{ color: "#5B6B82" }}>
            {label}
            <span
              className="relative inline-flex cursor-help"
              onMouseEnter={() => { setOpen(true); fetchHint() }}
              onMouseLeave={() => setOpen(false)}
            >
              <HelpCircle className="h-3.5 w-3.5" style={{ color: "#9AA7B8" }} />
              {open && (
                <div className="absolute right-0 top-6 z-50 w-64 rounded-lg border bg-white p-3 text-xs shadow-lg" style={{ borderColor: "#E8ECF2", color: "#5B6B82" }}>
                  {loading ? (
                    <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> AI 分析中...</span>
                  ) : hint ? (
                    hint
                  ) : (
                    "点击查看分析"
                  )}
                </div>
              )}
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold" style={{ color: "#1E2A3B" }}>{value}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${color}18`, color }}
          dangerouslySetInnerHTML={{ __html: icon }} />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "#F0F3F8" }}>
        <div className="h-full rounded-full" style={{ width: `${bar}%`, background: color }} />
      </div>
    </div>
  )
}
