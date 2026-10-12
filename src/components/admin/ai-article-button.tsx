'use client'

import { useState } from 'react'

/** 文章表单里的 AI 生成按钮：弹窗输入主题，生成后回调填回 title/content */
export function AiArticleButton({ onFill }: { onFill: (title: string, content: string) => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ topic: '', keywords: '', length: '1500', style: '专业科普' })

  async function run() {
    if (!form.topic.trim()) { setErr('请输入文章主题'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/admin/ai/gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: 'article_write', data: form }),
      })
      const json = await res.json()
      if (json.code !== 0) { setErr(json.message || '生成失败'); return }
      const text: string = json.content
      // 拆标题：找【标题1】xxx
      let title = ''
      const m = text.match(/【标题1】\s*(.+)/)
      if (m) title = m[1].trim()
      // 正文 = 去掉标题行后的剩余
      const body = text.replace(/【标题\d】[^\n]*\n?/g, '').trim()
      onFill(title || form.topic, body)
      setOpen(false)
    } catch {
      setErr('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white"
        style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)' }}
      >
        ✨ AI 写文章
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.4)' }} onClick={() => !loading && setOpen(false)}>
          <div className="w-[480px] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold">✨ AI 写文章</h3>
            <label className="mb-1 block text-xs text-slate-500">主题 *</label>
            <input autoFocus className="field mb-2 w-full rounded-lg border p-2 text-sm" placeholder="例：餐饮商家怎么做抖音"
              value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            <label className="mb-1 block text-xs text-slate-500">关键词（逗号分隔）</label>
            <input className="mb-2 w-full rounded-lg border p-2 text-sm" placeholder="例：门店引流,团购,短视频"
              value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            <div className="mb-2 flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-500">字数</label>
                <select className="w-full rounded-lg border p-2 text-sm" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })}>
                  <option value="800">800 字</option>
                  <option value="1500">1500 字</option>
                  <option value="3000">3000 字</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-500">风格</label>
                <select className="w-full rounded-lg border p-2 text-sm" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
                  <option>专业科普</option><option>口语化</option><option>案例复盘</option>
                </select>
              </div>
            </div>
            {err && <p className="mb-2 text-xs text-red-500">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-xs text-slate-600">取消</button>
              <button type="button" onClick={run} disabled={loading}
                className="rounded-lg px-3 py-2 text-xs text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)' }}>
                {loading ? 'AI 写作中…' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
