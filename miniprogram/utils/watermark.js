// utils/watermark.js —— 溯源水印瓦片（本地绘制）
//
// 后端 /api/miniapp/watermark 返回：
//   { enabled, text, backgroundImage, color, opacity, fontSize, gapX, gapY, rotate }
// 默认配置是 color=#c0c0c0 / opacity=0.2 / fontSize=12 / gap=300x250，
// 铺在浅色页面上几乎看不见，铺在深色大图预览上又偏灰 —— 所以这里**不直接用后端图**，
// 而是复用后端给的 text（含姓名+手机尾号+日期），按下面这套更深的参数在本地重绘瓦片。
//
// 关键点：深色填充 + 白色描边（双色），保证在「浅色页面」和「深色大图预览」上都能看见。

// ===== 水印参数（参考抖音电子营业执照：淡灰斜纹，无描边） =====
const WM = {
  color: '#c0c0c0',       // 淡灰
  opacity: 0.2,           // 20% 不透明度
  strokeColor: '',        // 无描边
  strokeOpacity: 0,
  strokeWidth: 0,
  fontSize: 12,           // 字号 12px，不再加大
  gapX: 300,              // 水平间距 300
  gapY: 250,              // 垂直间距 250
  rotate: -30,            // 斜 -30 度
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 生成一张可平铺的水印瓦片（SVG data URI） */
function buildTile(text, cfg) {
  const w = cfg.gapX
  const h = cfg.gapY
  const cx = w / 2
  const cy = h / 2
  const safe = escapeXml(text)
  const common =
    `x="${cx}" y="${cy}" font-size="${cfg.fontSize}" font-family="PingFang SC, Microsoft YaHei, sans-serif"` +
    ` text-anchor="middle" dominant-baseline="middle"`
  // 可选描边层（strokeColor 为空时跳过，不绘制描边）
  const stroke = cfg.strokeColor
    ? `<text ${common} fill="none" stroke="${cfg.strokeColor}" stroke-opacity="${cfg.strokeOpacity}" ` +
      `stroke-width="${cfg.strokeWidth}" stroke-linejoin="round">${safe}</text>`
    : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<g transform="rotate(${cfg.rotate} ${cx} ${cy})">` +
    stroke +
    `<text ${common} fill="${cfg.color}" fill-opacity="${cfg.opacity}">${safe}</text>` +
    `</g></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/**
 * 把后端返回的水印配置转换成本地加深版
 * @param {object} server 后端 /api/miniapp/watermark 的 data
 * @returns {{enabled:boolean, backgroundImage:string, bgSize:string}}
 */
function buildWatermark(server) {
  const off = { enabled: false, backgroundImage: '', bgSize: 'auto' }
  if (!server || !server.enabled) return off

  const text = server.text || server.label || ''
  // 后端没给文案时，退化用后端原图，至少保证水印不丢
  if (!text) {
    return { enabled: true, backgroundImage: server.backgroundImage || '', bgSize: 'auto' }
  }

  try {
    // 完全跟随后端「水印设置」返回的参数（颜色/透明度/字号/旋转/间距），
    // 后台改配置 → 小程序刷新即生效，无需发版。
    const cfg = {
      color: server.color || WM.color,
      opacity: typeof server.opacity === 'number' ? server.opacity : WM.opacity,
      strokeColor: '',
      strokeOpacity: 0,
      strokeWidth: 0,
      fontSize: typeof server.fontSize === 'number' ? server.fontSize : WM.fontSize,
      gapX: typeof server.gapX === 'number' ? server.gapX : WM.gapX,
      gapY: typeof server.gapY === 'number' ? server.gapY : WM.gapY,
      rotate: typeof server.rotate === 'number' ? server.rotate : WM.rotate,
    }
    return {
      enabled: true,
      backgroundImage: buildTile(text, cfg),
      bgSize: cfg.gapX + 'px ' + cfg.gapY + 'px',
    }
  } catch (e) {
    return { enabled: true, backgroundImage: server.backgroundImage || '', bgSize: 'auto' }
  }
}

module.exports = { buildWatermark, WM }
