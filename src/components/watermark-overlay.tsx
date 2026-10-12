'use client'

import { useMemo } from 'react'

/**
 * 通用斜纹平铺水印覆盖层（fixed 全屏，pointer-events-none 不拦操作）。
 * 用于：文章页（防抄袭）、订单详情、实名身份证、素材库预览等。
 * 与后端 /api/miniapp/watermark 的 buildSvg 同构，保证预览与实际一致。
 */

function escapeXml(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTile(text: string, cfg: { color: string; opacity: number; fontSize: number; gapX: number; gapY: number; rotate: number }): string {
  const w = cfg.gapX
  const h = cfg.gapY
  const cx = Math.round(w / 2)
  const cy = Math.round(h / 2)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<text x="${cx}" y="${cy}" font-size="${cfg.fontSize}" fill="${cfg.color}" fill-opacity="${cfg.opacity}" ` +
    `font-family="PingFang SC, Microsoft YaHei, sans-serif" text-anchor="middle" dominant-baseline="middle" ` +
    `transform="rotate(${cfg.rotate} ${cx} ${cy})">${escapeXml(text)}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

export function WatermarkOverlay({
  text,
  color = '#c0c0c0',
  opacity = 0.2,
  fontSize = 12,
  gapX = 300,
  gapY = 250,
  rotate = -30,
  zIndex = 40,
}: {
  text: string
  color?: string
  opacity?: number
  fontSize?: number
  gapX?: number
  gapY?: number
  rotate?: number
  zIndex?: number
}) {
  const bg = useMemo(() => {
    if (!text) return ''
    try {
      return buildTile(text, { color, opacity, fontSize, gapX: Math.max(40, gapX), gapY: Math.max(40, gapY), rotate })
    } catch {
      return ''
    }
  }, [text, color, opacity, fontSize, gapX, gapY, rotate])

  if (!bg) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex,
        backgroundImage: `url("${bg}")`,
        backgroundSize: `${Math.max(40, gapX)}px ${Math.max(40, gapY)}px`,
      }}
    />
  )
}
