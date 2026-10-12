'use client'

import { useState } from 'react'

/** 案例表单里的 AI 生成按钮 */
export function AiCaseButton({ onFill }: { onFill: (title: string, content: string) => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ industry: '', period: '', metrics: '' })

  async function run() {
    if (!form.industry.trim()) { setErr('请输入客户行业'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/admin/ai/gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: 'case_write', data: form }),
      })
      const json = await res.json()
      if (json.code !== 0) { setErr(json.message || '生成失败'); return }
      const text: string = json.content
      const m = text.match(/【案例标题】\s*(.+)/)
      const title = m ? m[1].trim() : form.industry + '服务案例'
      onFill(title, text)
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
        ✨ AI 写案例
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.4)' }} onClick={() => !loading && setOpen(false)}>
          <div className="w-[480px] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold">✨ AI 写案例</h3>
            <label className="mb-1 block text-xs text-slate-500">客户行业 *</label>
            <input autoFocus className="mb-2 w-full rounded-lg border p-2 text-sm" placeholder="例：餐饮 / 美业 / 教培"
              value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <label className="mb-1 block text-xs text-slate-500">服务周期</label>
            <input className="mb-2 w-full rounded-lg border p-2 text-sm" placeholder="例：3个月"
              value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
            <label className="mb-1 block text-xs text-slate-500">关键数据（涨粉/GMV等）</label>
            <textarea className="mb-2 w-full rounded-lg border p-2 text-sm" rows={3} placeholder="例：涨粉 5000+，GMV 20 万"
              value={form.metrics} onChange={(e) => setForm({ ...form, metrics: e.target.value })} />
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
