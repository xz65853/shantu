'use client'

import { useState } from 'react'

/** 工作台 AI 今日播报卡片 */
export function AiBriefCard() {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/ai/gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: 'dashboard_brief', data: {} }),
      })
      const json = await res.json()
      if (json.code === 0) setContent(json.content)
      else setError(json.message || '生成失败')
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'linear-gradient(135deg,#667eea12,#764ba212)', border: '1px solid #667eea33' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <h3 className="text-sm font-semibold" style={{ color: '#4B3B9E' }}>AI 今日播报</h3>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg px-3 py-1.5 text-xs text-white transition disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)' }}
        >
          {loading ? 'AI 思考中…' : content ? '重新生成' : '生成播报'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs" style={{ color: '#E5544B' }}>{error}</p>}
      {loading && (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 rounded" style={{ background: '#E8E4F5' }} />
          <div className="h-3 w-1/2 rounded" style={{ background: '#E8E4F5' }} />
          <div className="h-3 w-2/3 rounded" style={{ background: '#E8E4F5' }} />
        </div>
      )}
      {!loading && content && (
        <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: '#3B3560', fontFamily: 'inherit' }}>
          {content}
        </pre>
      )}
      {!loading && !content && !error && (
        <p className="mt-2 text-xs" style={{ color: '#8A82B0' }}>
          基于今日真实订单、合同、线索数据，一键生成今日工作重点。
        </p>
      )}
    </div>
  )
}
