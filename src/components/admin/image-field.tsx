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

export function ImageField({
  value,
  onChange,
  label = '图片',
  folder = 'common',
}: {
  value: string
  onChange: (url: string) => void
  label?: string
  folder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function upload(file: File) {
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
      onChange(json.data.url as string)
    } catch {
      setError('上传失败，请重试')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          className="field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="图片地址，或点击右侧上传"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-outline shrink-0 px-3"
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          上传
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 rounded-lg border border-line px-2.5 text-slate-400 hover:border-red-200 hover:text-red-600"
            aria-label="清除"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
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
      {value ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-line bg-mist">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="预览" className="max-h-40 w-full object-contain" />
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
