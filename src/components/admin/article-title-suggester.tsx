"use client"

import { useState } from "react"
import { Sparkles, Loader2, X, Check } from "lucide-react"

export function ArticleTitleSuggester({ articleId, currentTitle, content }: { articleId: number; currentTitle: string; content?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [titles, setTitles] = useState<string[]>([])
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState(false)

  async function generate() {
    setLoading(true)
    setError("")
    setTitles([])
    try {
      const res = await fetch("/api/admin/ai/gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: "title_suggest", data: { content: content || currentTitle } }),
      })
      const json = await res.json()
      if (json.code !== 0) throw new Error(json.message || "生成失败")
      const lines = String(json.content || "")
        .split("\n")
        .map((l: string) => l.replace(/^[\d.、）)]+\s*/, "").replace(/^【.*?】/, "").trim())
        .filter(Boolean)
        .slice(0, 5)
      if (!lines.length) throw new Error("AI 没有返回标题")
      setTitles(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败")
    } finally {
      setLoading(false)
    }
  }

  async function pick(title: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const json = await res.json()
      if (json.code !== 0) throw new Error(json.message || "更新失败")
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败")
      setUpdating(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); if (!titles.length) generate() }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-600 hover:bg-violet-50"
        title="AI 生成爆款标题"
      >
        <Sparkles className="h-3.5 w-3.5" /> 改标题
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">AI 爆款标题推荐</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 text-xs text-slate-500">当前：{currentTitle}</p>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> AI 思考中...</div>
            ) : error ? (
              <div className="py-4">
                <p className="mb-3 text-sm text-red-500">{error}</p>
                <button onClick={generate} className="text-xs text-blue-600 hover:underline">重试</button>
              </div>
            ) : (
              <div className="space-y-2">
                {titles.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => pick(t)}
                    disabled={updating}
                    className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-left text-sm hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4 shrink-0 text-blue-500" />
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
