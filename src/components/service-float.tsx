'use client'

import { useState } from 'react'
import { Headset, X } from 'lucide-react'

export function ServiceFloat({
  wechatQrcode = '',
  phone = '',
}: {
  wechatQrcode?: string
  phone?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="联系客服"
        className="fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 lg:bottom-6"
      >
        <Headset className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed bottom-40 right-4 z-50 w-72 rounded-2xl border border-line bg-white p-5 shadow-xl lg:bottom-20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">联系顾问</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 transition hover:text-slate-600"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {wechatQrcode ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wechatQrcode}
                alt="企业微信客服二维码"
                className="mx-auto mt-3 h-44 w-44 rounded-lg object-contain"
              />
              <p className="mt-2 text-center text-xs text-slate-500">微信扫码，添加顾问咨询</p>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
              扫码添加顾问微信，获取一对一运营方案
            </p>
          )}

          {phone ? (
            <a
              href={`tel:${phone}`}
              className="mt-3 block rounded-lg border border-brand-200 py-2 text-center text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              电话咨询 {phone}
            </a>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
