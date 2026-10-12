'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

export function AdminListActions({
  editHref,
  previewHref,
  apiPath,
  confirmText = '确定删除？',
}: {
  editHref: string
  previewHref?: string
  apiPath: string
  confirmText?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!confirm(confirmText)) return
    setBusy(true)
    try {
      await fetch(apiPath, { method: 'DELETE' })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {previewHref ? (
        <Link
          href={previewHref}
          target="_blank"
          className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:text-brand-700"
        >
          预览
        </Link>
      ) : null}
      <Link
        href={editHref}
        className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700"
      >
        编辑
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-md border border-line p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
        aria-label="删除"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
