import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api'
import { getActiveMember } from '@/lib/member-auth'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/** 取服务器当天日期（北京时间）YYYY-MM-DD */
function todayShanghai(): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 生成单个平铺单元的 SVG（含一段斜排文字），转 base64 data URI 供 background-image 平铺 */
function buildSvg(text: string, cfg: { color: string; opacity: number; fontSize: number; gapX: number; gapY: number; rotate: number }): string {
  const w = cfg.gapX
  const h = cfg.gapY
  const cx = Math.round(w / 2)
  const cy = Math.round(h / 2)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<text x="${cx}" y="${cy}" font-size="${cfg.fontSize}" fill="${cfg.color}" fill-opacity="${cfg.opacity}" ` +
    `font-family="PingFang SC, Microsoft YaHei, sans-serif" text-anchor="middle" dominant-baseline="middle" ` +
    `transform="rotate(${cfg.rotate} ${cx} ${cy})">${escapeXml(text)}</text></svg>`
  const b64 = Buffer.from(svg, 'utf8').toString('base64')
  // 返回纯 data URI（不含 url() 包裹），前端在 WXML 里用单引号包裹，避免双引号嵌套破坏解析
  return `data:image/svg+xml;base64,${b64}`
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * 小程序溯源水印配置（GET，可匿名）
 * - 未登录（看案例）→ 水印文字「演示数据」
 * - 已登录 → 按模板拼「姓名 ***手机后4位 日期」
 * - 返回 background-image 平铺所需 base64 SVG，前端 fixed 层引用即可，无需逐字渲染
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await getSettings()
    const enabled = s.watermark_enable !== '0'

    const color = s.watermark_color || '#c0c0c0'
    const opacity = Math.min(1, Math.max(0, num(s.watermark_opacity, 0.2)))
    const fontSize = num(s.watermark_font_size, 12)
    const gapX = num(s.watermark_gap_x, 300)
    const gapY = num(s.watermark_gap_y, 250)
    const rotate = num(s.watermark_rotate, -30)
    const template = s.watermark_template || '{name} {phone4} {date}'
    const guestText = s.watermark_guest_text || '演示数据'

    if (!enabled) {
      return ok({ enabled: false })
    }

    let text = guestText

    const auth = await getActiveMember(req)
    if (auth) {
      const m = auth.member
      const name = (m.name || m.nickname || '').trim()
      const phone = (m.phone || '').trim()
      const phone4 = phone.length >= 4 ? phone.slice(-4) : phone || '****'
      const date = todayShanghai()

      // 姓名缺失时溯源无意义，回退演示数据
      if (name) {
        text = template
          .replace(/\{name\}/g, name)
          .replace(/\{phone4\}/g, phone4)
          .replace(/\{date\}/g, date)
          .replace(/\s+/g, ' ')
          .trim()
      }
    }

    return ok({
      enabled: true,
      text,
      backgroundImage: buildSvg(text, { color, opacity, fontSize, gapX, gapY, rotate }),
      color,
      opacity,
      fontSize,
      gapX,
      gapY,
      rotate,
    })
  })
}
