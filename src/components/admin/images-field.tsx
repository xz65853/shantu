'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'

/** 上传前用 canvas 压缩为 WebP，减少体积 */
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

/** 多图上传（用于月报截图 / 日报截图，最多 9 张） */
export function ImagesField({
  value,
  onChange,
  label = '图片',
  folder = 'common',
  max = 9,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  label?: string
  folder?: string
  max?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const urls = value || []

  async function upload(file: File) {
    if (urls.length >= max) {
      setError(`最多上传 ${max} 张`)
      return
    }
    setUploading(true)
    setError('')
    try {
      const optimized = await compress(file)
      const fd = new FormData()
      fd.append('file', optimized)
      fd.append('folder', folder)
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || json.code !== 0) {
        setError(json.message || '上传失败')
        return
      }
      onChange([...urls, json.data.url as string])
    } catch {
      setError('上传失败，请重试')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <label className="label">
        {label}
        <span className="ml-1 text-xs font-normal text-slate-400">
          （{urls.length}/{max}）
        </span>
      </label>
      {urls.length ? (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u, i) => (
            <div key={`${u}-${i}`} className="group relative overflow-hidden rounded-lg border border-line bg-mist">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-20 w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="删除"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {urls.length < max ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-slate-500 transition hover:border-brand-300 hover:text-brand-600"
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          添加图片
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
        }}
      />
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
