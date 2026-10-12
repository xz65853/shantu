'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ImageField } from './image-field'
import { slugify } from '@/lib/utils'
import { AiArticleButton } from './ai-article-button'

export type ArticleFormValue = {
  id?: number
  title: string
  slug: string
  summary: string
  content: string
  cover: string
  author: string
  seoTitle: string
  seoDesc: string
  status: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  publishedAt: string
  categoryId: number | null
}

export function ArticleForm({
  initial,
  categories,
}: {
  initial: ArticleFormValue
  categories: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof ArticleFormValue>(key: K, value: ArticleFormValue[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('请填写文章标题')
    if (!form.content.trim()) return setError('请填写正文内容')

    setSaving(true)
    setError('')
    try {
      const url = form.id ? `/api/admin/articles/${form.id}` : '/api/admin/articles'
      const res = await fetch(url, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '保存失败')
        return
      }
      router.push('/admin/articles')
      router.refresh()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex justify-end"><AiArticleButton onFill={(title, content) => { set('title', title); set('content', content) }} /></div>
            <label className="label">文章标题 *</label>
            <input
              className="field"
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value)
                if (!form.id && !form.slug) set('slug', slugify(e.target.value))
              }}
            />
          </div>
          <div>
            <label className="label">URL 别名 *</label>
            <input className="field" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
          </div>
          <div>
            <label className="label">分类</label>
            <select
              className="field"
              value={form.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">作者</label>
            <input className="field" value={form.author} onChange={(e) => set('author', e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">摘要</label>
          <textarea className="field min-h-[70px]" value={form.summary} onChange={(e) => set('summary', e.target.value)} />
        </div>

        <div className="mt-4">
          <ImageField value={form.cover} onChange={(v) => set('cover', v)} label="封面图" folder="articles" />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <label className="label">正文内容 *</label>
        <p className="mb-2 text-xs text-slate-400">每行渲染为一个段落，建议一段一换行。</p>
        <textarea
          className="field min-h-[320px] font-normal"
          value={form.content}
          onChange={(e) => set('content', e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">SEO 与发布</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">SEO 标题</label>
            <input className="field" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
          </div>
          <div>
            <label className="label">SEO 描述</label>
            <input className="field" value={form.seoDesc} onChange={(e) => set('seoDesc', e.target.value)} />
          </div>
          <div>
            <label className="label">发布时间</label>
            <input
              type="date"
              className="field"
              value={form.publishedAt ? form.publishedAt.slice(0, 10) : ''}
              onChange={(e) => set('publishedAt', e.target.value)}
            />
          </div>
          <div>
            <label className="label">发布状态</label>
            <select
              className="field"
              value={form.status}
              onChange={(e) => set('status', e.target.value as ArticleFormValue['status'])}
            >
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">发布</option>
              <option value="OFFLINE">下架</option>
            </select>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存文章
        </button>
        <button type="button" className="btn-outline" onClick={() => router.push('/admin/articles')}>
          返回列表
        </button>
      </div>
    </form>
  )
}
