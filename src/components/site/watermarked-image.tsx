'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface WatermarkedImageProps {
  src: string
  alt: string
  className?: string
  /** 水印文字，默认「桃江闪途网络」 */
  text?: string
  /** 强度 0~1，默认 0.3（越大越明显） */
  opacity?: number
  /** 旋转角度（度），默认 -28 */
  rotateDeg?: number
  /**
   * 配色：
   * - light（默认）：纯白半透明
   * - contrast：深色字 + 白色描边，白底/深底都能看见（浅色图片可按需切换）
   * - dark：纯黑半透明（适合浅色图片）
   */
  tone?: 'light' | 'contrast' | 'dark'
  /** 是否允许点击放大（放大后水印重新按大尺寸铺排，同步放大） */
  zoomable?: boolean
}

type Layout = { cols: number; rows: number; fontSize: number; gapX: number; gapY: number }

/** 按容器实际尺寸计算水印字号与行列数；容器变化时自动重算（放大预览会同步放大） */
function useWatermarkLayout(ref: React.RefObject<HTMLElement | null>, text: string): Layout {
  const [layout, setLayout] = useState<Layout>({ cols: 12, rows: 8, fontSize: 15, gapX: 32, gapY: 48 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const w = el.clientWidth || 600
      const h = el.clientHeight || 400
      // 字号随容器尺寸自适应：小图小字、大图大字（放大预览时水印同步变大）
      const fontSize = Math.max(12, Math.min(72, Math.round(Math.min(w, h) / 42)))
      const textW = fontSize * text.length
      const gapX = Math.round(fontSize * 2)
      const gapY = Math.round(fontSize * 3)
      // 水印层放大到 300% 后居中旋转，行列数按 300% 区域计算（+2 余量保证四角覆盖）
      const cols = Math.ceil((w * 3) / (textW + gapX)) + 2
      const rows = Math.ceil((h * 3) / (fontSize + gapY)) + 2
      setLayout((prev) =>
        prev.cols === cols && prev.rows === rows && prev.fontSize === fontSize
          ? prev
          : { cols, rows, fontSize, gapX, gapY },
      )
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, text])

  return layout
}

/** 水印文字配色：默认纯白半透明；contrast 为深色字 + 白色描边 */
function useWatermarkTextStyle(tone: 'light' | 'contrast' | 'dark', opacity: number) {
  return useMemo(() => {
    if (tone === 'contrast') {
      const ink = Math.min(1, opacity * 1.05)
      const halo = Math.min(1, opacity * 1.6)
      const halo2 = Math.min(1, opacity * 2)
      return {
        color: `rgba(17,24,39,${ink.toFixed(3)})`,
        textShadow: `0 0 3px rgba(255,255,255,${halo.toFixed(3)}), 0 0 1px rgba(255,255,255,${halo2.toFixed(3)})`,
      }
    }
    if (tone === 'dark') {
      return { color: `rgba(0,0,0,${opacity.toFixed(3)})`, textShadow: 'none' as const }
    }
    // light（默认）：纯白
    return { color: `rgba(255,255,255,${opacity.toFixed(3)})`, textShadow: 'none' as const }
  }, [tone, opacity])
}

/** 满屏斜铺水印层（纯展示，不拦事件） */
function WatermarkLayer({
  layout,
  text,
  rotateDeg,
  textStyle,
}: {
  layout: Layout
  text: string
  rotateDeg: number
  textStyle: React.CSSProperties
}) {
  const items = useMemo(() => Array.from({ length: layout.cols * layout.rows }), [layout])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {/* 内层 300% 尺寸 + 居中 + 旋转，保证旋转后四角仍被覆盖 */}
      <div
        className="absolute left-1/2 top-1/2 grid"
        style={{
          width: '300%',
          height: '300%',
          transform: `translate(-50%, -50%) rotate(${rotateDeg}deg)`,
          gridTemplateColumns: `repeat(${layout.cols}, max-content)`,
          gridTemplateRows: `repeat(${layout.rows}, max-content)`,
          gap: `${layout.gapY}px ${layout.gapX}px`,
        }}
      >
        {items.map((_, i) => (
          <span key={i} className="whitespace-nowrap font-medium" style={{ fontSize: layout.fontSize, ...textStyle }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 放大预览：独立测量容器 → 水印随预览尺寸重新铺排（字号更大、依旧满屏） */
function ZoomPreview({
  src,
  alt,
  text,
  rotateDeg,
  tone,
  opacity,
  onClose,
}: {
  src: string
  alt: string
  text: string
  rotateDeg: number
  tone: 'contrast' | 'light' | 'dark'
  opacity: number
  onClose: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const layout = useWatermarkLayout(boxRef, text)
  const textStyle = useWatermarkTextStyle(tone, opacity)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div ref={boxRef} className="relative h-full w-full">
        <img src={src} alt={alt} draggable={false} className="h-full w-full select-none object-contain" />
        <WatermarkLayer layout={layout} text={text} rotateDeg={rotateDeg} textStyle={textStyle} />
      </div>
      <button
        type="button"
        aria-label="关闭"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white hover:bg-white/25"
        onClick={onClose}
      >
        ×
      </button>
      <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/45 px-3 py-1 text-xs tracking-wide text-white/90">
        {text} · 数据已脱敏 · 点击任意处关闭
      </span>
    </div>
  )
}

/**
 * 满屏斜铺水印图片
 * - 字号 / 行列数按容器实际尺寸计算，任意宽高比均匀铺满、不露半截水印
 * - ResizeObserver 监听尺寸：窗口缩放、点击放大预览都会重新铺排
 * - 默认「深色字 + 白色描边」，白底图也不会看不见
 * - pointer-events-none / select-none，不拦鼠标、不可选中
 */
export function WatermarkedImage({
  src,
  alt,
  className = '',
  text = '桃江闪途网络',
  opacity = 0.3,
  rotateDeg = -28,
  tone = 'light',
  zoomable = true,
}: WatermarkedImageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const layout = useWatermarkLayout(ref, text)
  const textStyle = useWatermarkTextStyle(tone, opacity)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <div
        ref={ref}
        className={`relative overflow-hidden ${zoomable ? 'cursor-zoom-in' : ''} ${className}`}
        onClick={zoomable ? () => setOpen(true) : undefined}
        role={zoomable ? 'button' : undefined}
        tabIndex={zoomable ? 0 : undefined}
        onKeyDown={
          zoomable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpen(true)
                }
              }
            : undefined
        }
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="h-full w-full select-none object-cover"
        />
        <WatermarkLayer layout={layout} text={text} rotateDeg={rotateDeg} textStyle={textStyle} />
      </div>

      {open ? (
        <ZoomPreview
          src={src}
          alt={alt}
          text={text}
          rotateDeg={rotateDeg}
          tone={tone}
          opacity={opacity}
          onClose={close}
        />
      ) : null}
    </>
  )
}
