'use client'

import { useRef, useState } from 'react'
import { Copy, Loader2, Search, Trash2, Upload } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export type MediaItem = {
  id: number
  filename: string
  url: string
  mimeType: string | null
  size: number
  folder: string
  createdAt: string
}

const FOLDERS = [
  { key: 'all', label: '全部' },
  { key: 'cases', label: '案例' },
  { key: 'articles', label: '文章' },
  { key: 'banners', label: 'Banner' },
  { key: 'common', label: '通用' },
]

async function compress(file: File, maxWidth = 1920, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  if (file.size < 300 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxWidth / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // iOS 小程序不支持 webp，统一转 jpeg（照片）/png（透明图），避免 iPhone 端图片不显示
    const isPng = file.type === 'image/png'
    const outType = isPng ? 'image/png' : 'image/jpeg'
    const ext = isPng ? '.png' : '.jpg'
    if (!isPng) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b || file), outType, quality),
    )
    return new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: outType })
  } catch {
    return file
  }
}

export function MediaLibrary({ items }: { items: MediaItem[] }) {
  const [folder, setFolder] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files || !files.length) return
    setUploading(true)
    try {
      for (const raw of Array.from(files)) {
        const file = await compress(raw)
        if (file.size > 20 * 1024 * 1024) continue
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', folder === 'all' ? 'common' : folder)
        await fetch('/api/admin/media', { method: 'POST', body: fd })
      }
      window.location.reload()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(id: number) {
    if (!confirm('确定删除该文件？')) return
    await fetch(`/api/admin/media?id=${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(''), 1800)
    } catch {
      // 忽略
    }
  }

  const filtered = items.filter((item) => {
    if (folder !== 'all' && item.folder !== folder) return false
    if (keyword.trim() && !item.filename.toLowerCase().includes(keyword.trim().toLowerCase())) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-5">
      {mediaWmOn ? <WatermarkOverlay text={mediaWmText} color="#c0c0c0" opacity={0.12} fontSize={13} zIndex={50} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFolder(f.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                folder === f.key
                  ? 'border-ink bg-ink text-white'
                  : 'border-line text-slate-600 hover:border-brand-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            className="field py-2 pl-9 text-xs"
            placeholder="搜索文件名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary" disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          上传文件
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="aspect-square bg-mist">
                {item.mimeType?.startsWith('video') ? (
                  <video src={item.url} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.filename} className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="p-3">
                <div className="truncate text-xs text-slate-600" title={item.filename}>
                  {item.filename}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {(item.size / 1024).toFixed(0)} KB · {formatDate(item.createdAt)}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(item.url)}
                    className="flex-1 rounded-md border border-line px-2 py-1 text-[11px] text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    {copied === item.url ? '已复制' : '复制链接'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="rounded-md border border-line p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line py-20 text-center">
          <Copy className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">还没有文件，点击右上角上传（单文件不超过 20MB）</p>
        </div>
      )}
    </div>
  )
}
