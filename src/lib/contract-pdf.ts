import PDFDocument from 'pdfkit'
import { PDFDocument as PDFLib } from 'pdf-lib'
import path from 'path'
import fs from 'fs'

const FONT_PATH = path.join('/www/wwwroot/shantu-web', 'assets/fonts/NotoSansSC-Regular.otf')

/**
 * 落款区版式（单位 pt，A4 = 595 x 842）。
 * 签名图（甲方）与公章（乙方）并排放在正文末尾下方，紧跟正文，
 * 保证「签名 + 公章」与正文在同一页，不再单独甩到末页。
 * 坐标说明：签名图/公章以「距页顶」定义 topGap（相对正文末行底部），
 * pdf-lib 绘制时换算为「距页底」：y_bottom = pageHeight - topGap - 元素高度。
 */
export const PDF_LAYOUT = {
  signature: { x: 66, width: 132, height: 52, topGap: 16 }, // 甲方签名图（距正文底部 16pt）
  partyBSign: { fromRight: 66, width: 132, height: 52, topGap: 16 }, // 乙方负责人签名图（与甲方同行，靠右）
  seal: { size: 110, fromRight: 170, topGap: 14 }, // 公章（距正文底部 14pt）
  // 签署区（末两行 + 签名图 + 公章）估算高度，正文排到此处若放不下则提前翻页
  reserveBlockHeight: 210,
}

/** A4 尺寸（pt） */
const A4 = { width: 595.28, height: 841.89 }

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|section)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;'/g, '>')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fillTemplate(contentHtml: string, data: Record<string, string>): string {
  let out = contentHtml
  for (const [k, v] of Object.entries(data)) {
    out = out.split(`{{${k}}}`).join(v || '')
  }
  return out
}

/**
 * 水印文字净化：只保留字体确定有字形的字符（中文/字母/数字/常用符号）。
 * 客户姓名可能含 emoji（如国旗）等 NotoSansSC 缺失的字形，直接剔除，
 * 避免渲染成豆腐块。
 */
function sanitizeWatermarkText(raw: string): string {
  return (raw || '')
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9·*#\-\: ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchImage(url: string): Promise<Buffer | null> {
  if (!url) return null
  if (url.startsWith('http')) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!r.ok) return null
      return Buffer.from(await r.arrayBuffer())
    } catch {
      return null
    }
  }
  // 站内路径 → 磁盘文件（按优先级依次尝试，命中即返回）：
  // - /api/files/...  媒体库接口，实际位于 <项目根>/uploads/...（见 api/files/[...path] 路由）
  // - /uploads/...    合同 PDF、签名原图等，实际位于 <项目根>/uploads/...（不是 public/uploads）
  // - 兜底            <项目根>/public/...（历史静态资源）
  const ROOT = '/www/wwwroot/shantu-web'
  const candidates: string[] = []
  if (url.startsWith('/api/files/')) {
    candidates.push(path.join(ROOT, 'uploads', url.replace(/^\/api\/files\//, '')))
  } else if (url.startsWith('/uploads/')) {
    candidates.push(path.join(ROOT, url))
    candidates.push(path.join(ROOT, 'public', url))
  } else {
    candidates.push(url, path.join(ROOT, url.replace(/^\//, '')))
  }
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return fs.readFileSync(p)
  }
  console.error('[contract-pdf] 图片读取失败:', url, '已尝试:', candidates.join(' | '))
  return null
}

/**
 * 第 1 层：正文渲染（pdfkit，全程不做任何坐标变换）。
 *
 * 重要教训：不要在这个文档里用 doc.rotate()。pdfkit 的 rotate 会更新内部
 * 变换矩阵，restore() 虽然输出 Q 操作符，但实测正文文字仍会被写进旋转后
 * 的坐标系（Tm x 达到数千、超出页宽），整页正文跑到页面外 —— 这正是
 * 「合同 PDF 只显示水印、正文空白」事故的根因。因此斜铺水印在独立文档
 * 中渲染，再用 pdf-lib 叠加到本文档的每一页。
 *
 * 落款（签名图 + 公章）紧跟正文末尾：正文排到「甲方签署」段前若剩余空间
 * 不足以容纳签署区则提前翻页，保证签署区与正文同页、不被甩到末页。
 * 返回 bodyEndY（正文末行底部距页顶），供签名图/公章合成定位。
 */
async function renderBodyPdf(params: {
  contentHtml: string
  data: Record<string, string>
  partyBName?: string
  watermark?: string
}): Promise<{ buffer: Buffer; bodyEndY: number }> {
  const text = stripHtml(fillTemplate(params.contentHtml, params.data))
  const paragraphs = text.split('\n').map((s) => s.trim())

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      // 底边距 36：给页脚水印留出空间，避免 pdfkit 因文字越界自动追加空白页
      margins: { top: 60, bottom: 36, left: 60, right: 60 },
      info: { Title: '闪途数字营销服务合同' },
    })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), bodyEndY }))
    doc.on('error', reject)

    doc.registerFont('cn', FONT_PATH)
    doc.font('cn')

    doc.fontSize(20).fillColor('#000000').text('闪途数字营销服务合同', { align: 'center' })
    doc.moveDown(0.5)

    let bodyEndY = 0
    doc.fontSize(11).fillColor('#000000')
    for (const para of paragraphs) {
      if (!para) {
        doc.moveDown(0.3)
        continue
      }
      // 进入「甲方签署」段（末两行）前，若当前页放不下签署区，提前翻页
      if (para.startsWith('甲方签署') && doc.y > doc.page.height - PDF_LAYOUT.reserveBlockHeight) {
        doc.addPage()
      }
      doc.text(para, { lineGap: 4 })
    }
    bodyEndY = doc.y

    // 隐形水印（openid + 时间戳）：固定在页脚，lineBreak=false 防止触发自动翻页
    if (params.watermark) {
      doc
        .fontSize(7)
        .fillColor('#dddddd')
        .text(params.watermark, 60, doc.page.height - 34, { align: 'left', lineBreak: false })
    }

    doc.end()
  })
}

/**
 * 第 2 层：斜铺水印（独立文档）。
 * 旋转只发生在本文档内、且之后不再绘制任何内容，因此 rotate 的
 * 坐标系泄漏不会影响正文。最终由 mergeWatermarkOverlay 叠到底稿上。
 */
async function renderWatermarkOverlay(
  text: string,
  width: number,
  height: number,
  pages: number,
  style?: { fontSize?: number; color?: string; opacity?: number; rotate?: number; gapX?: number; gapY?: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [width, height], margin: 0, info: { Title: 'watermark' } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont('wm', FONT_PATH)
    doc.font('wm')

    const draw = () => {
      try {
        // 水印样式：后台「水印设置」可调（字号/颜色/透明度/旋转/横纵间距）
        const fontSize = style?.fontSize ?? 11
        const color = style?.color ?? '#999999'
        const opacity = Math.min(1, Math.max(0, style?.opacity ?? 0.5))
        const angle = style?.rotate ?? -30
        // 横纵间距（pt）：控制水印网格密度，默认 300x250（约 3 列 x 4 行）
        const gapX = Math.max(80, style?.gapX ?? 300)
        const gapY = Math.max(80, style?.gapY ?? 250)

        // 安全区（避开标题与签字栏）：
        const topSafe = 130
        const bottomSafe = height - 190
        const leftSafe = 50
        const rightSafe = width - 170

        const usableW = rightSafe - leftSafe
        const usableH = bottomSafe - topSafe
        // 网格列数/行数按间距计算，至少 1 列 1 行
        const cols = Math.max(1, Math.floor(usableW / gapX) + 1)
        const rows = Math.max(1, Math.floor(usableH / gapY) + 1)
        const colStep = cols > 1 ? usableW / (cols - 1) : usableW
        const rowStep = rows > 1 ? usableH / (rows - 1) : usableH
        const stagger = colStep / 2

        const anchors: Array<[number, number]> = []
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const x = leftSafe + col * colStep + (row % 2 === 1 ? stagger : 0)
            const y = topSafe + row * rowStep
            if (x <= rightSafe && y <= bottomSafe) {
              anchors.push([x, y])
            }
          }
        }

        doc.fontSize(fontSize).fillColor(color, opacity)
        for (const [x, y] of anchors) {
          doc.save()
          doc.translate(x, y)
          doc.rotate(angle)
          doc.text(text, 0, 0, { lineBreak: false })
          doc.restore()
        }
      } catch {
        /* 忽略水印渲染失败 */
      }
    }

    for (let i = 0; i < Math.max(1, pages); i += 1) {
      if (i > 0) doc.addPage()
      draw()
    }
    doc.end()
  })
}

/** 把水印层叠加到底稿每一页（水印在正文之上、透明度 0.35；公章与签名在之后绘制，故不会被水印遮挡） */
async function mergeWatermarkOverlay(base: Buffer, overlay: Buffer): Promise<Buffer> {
  const out = await PDFLib.load(base)
  const embeddedPages = await out.embedPdf(overlay, (await PDFLib.load(overlay)).getPageIndices())
  out.getPages().forEach((page, i) => {
    const emb = embeddedPages[i]
    if (!emb) return
    page.drawPage(emb, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  })
  return Buffer.from(await out.save())
}

/** 第 3 层：正文末尾乙方侧盖公章（pdf-lib，距页顶 topGap 换算为距页底；保持原图比例） */
async function drawSealImage(pdf: Buffer, seal: Buffer, bodyEndY: number): Promise<Buffer> {
  const out = await PDFLib.load(pdf)
  const page = out.getPage(out.getPageCount() - 1)
  let img
  try {
    img = await out.embedPng(seal)
  } catch {
    img = await out.embedJpg(seal)
  }
  const maxSize = PDF_LAYOUT.seal.size
  // 按原图宽高比缩放，避免非正方形印章被拉伸变形
  const ratio = img.width / img.height || 1
  const width = ratio >= 1 ? maxSize : maxSize * ratio
  const height = ratio >= 1 ? maxSize / ratio : maxSize
  const x = page.getWidth() - PDF_LAYOUT.seal.fromRight
  const y = page.getHeight() - (bodyEndY + PDF_LAYOUT.seal.topGap) - height
  page.drawImage(img, { x, y, width, height })
  return Buffer.from(await out.save())
}

/** 渲染调试副本到 logs/contracts/，供人工打开核验（要求：先存档再返回前端） */
function saveDebugCopy(pdf: Buffer, tag?: string) {
  if (!tag) return
  try {
    const dir = path.join('/www/wwwroot/shantu-web', 'logs', 'contracts')
    fs.mkdirSync(dir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    fs.writeFileSync(path.join(dir, `${tag}-${ts}.pdf`), pdf)
    // 只保留最近 20 份调试副本，防止 logs 无限膨胀
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.pdf'))
      .sort()
    while (files.length > 20) {
      const oldest = files.shift()
      if (oldest) fs.unlinkSync(path.join(dir, oldest))
    }
  } catch {
    /* 调试副本失败不影响主流程 */
  }
}

/**
 * 页码层（pdfkit 渲染，与斜铺水印同一手法）：每页底部居中「第 X 页 / 共 Y 页」。
 * 不用 pdf-lib 的 embedFont —— 它需要 fontkit 实例，而 fontkit 在 Next 打包后无法正常引入，
 * 曾导致页码静默失败（PDF 长期没有页码）。pdfkit 嵌中文字体的路径正文已验证可用。
 */
async function renderPageNumberOverlay(width: number, height: number, total: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [width, height], margin: 0, info: { Title: 'pageno' } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont('cn', FONT_PATH)
    doc.font('cn')

    for (let i = 0; i < Math.max(1, total); i += 1) {
      if (i > 0) doc.addPage()
      doc
        .fontSize(9)
        .fillColor('#8c8c8c')
        .text(`第 ${i + 1} 页 / 共 ${total} 页`, 0, height - 34, {
          // 必须显式给 width，否则 pdfkit 按文本自然宽度排版，align:center 不生效（页码贴左）
          width,
          align: 'center',
          lineBreak: false,
        })
    }
    doc.end()
  })
}

/** 每页底部加页码：叠加页码层到底稿每一页 */
async function drawPageNumbers(pdf: Buffer): Promise<Buffer> {
  const baseDoc = await PDFLib.load(pdf)
  const total = baseDoc.getPageCount()
  const overlay = await renderPageNumberOverlay(A4.width, A4.height, total)
  return mergeWatermarkOverlay(pdf, overlay)
}

export async function generateContractPdf(params: {
  contentHtml: string
  data: Record<string, string>
  sealImageUrl?: string | null
  partyBName?: string
  /** 乙方主体类型：individual=个体户（负责人签字，不盖章） / company=公司（盖章） */
  partyBType?: string | null
  watermark?: string
  /** 页面斜铺水印：客户姓名 + 身份证后4位 + 时间戳 */
  pageWatermark?: string
  /** 水印样式（后台可调）：字号/颜色/透明度/旋转/间距 */
  watermarkStyle?: { fontSize?: number; color?: string; opacity?: number; rotate?: number; gapX?: number; gapY?: number }
  /** 调试副本文件名（不含扩展名），传 orderNo 便于人工核验 */
  debugTag?: string
}): Promise<{ buffer: Buffer; bodyEndY: number }> {
  // 1) 正文（白底黑字，无任何变换），并拿到正文末行底部坐标用于落款合成
  const { buffer: bodyPdf, bodyEndY } = await renderBodyPdf(params)
  let pdf = bodyPdf

  // 2) 斜铺水印层（独立渲染后叠加，透明度 0.35，不挡正文）
  const wm = sanitizeWatermarkText(params.pageWatermark || '')
  if (wm) {
    try {
      const baseDoc = await PDFLib.load(pdf)
      const pageCount = baseDoc.getPageCount()
      const overlay = await renderWatermarkOverlay(wm, A4.width, A4.height, pageCount, params.watermarkStyle)
      pdf = await mergeWatermarkOverlay(pdf, overlay)
    } catch {
      /* 水印失败时降级为无斜铺水印，正文必须可见 */
    }
  }

  // 3) 公章（正文末尾乙方侧，紧跟正文）：仅公司主体盖章；个体户为负责人签字（正文落款文字）
  if (params.partyBType !== 'individual' && params.sealImageUrl) {
    const seal = await fetchImage(params.sealImageUrl)
    if (seal) {
      try {
        pdf = await drawSealImage(pdf, seal, bodyEndY)
      } catch {
        /* 忽略公章渲染失败 */
      }
    }
  }

  // 4) 页码（每页底部居中）
  try {
    pdf = await drawPageNumbers(pdf)
  } catch (e) {
    // 记录原因：此前因静默吞错，页码缺失长期未被发现
    console.error('[contract-pdf] 页码渲染失败:', (e as Error)?.message || e)
  }

  saveDebugCopy(pdf, params.debugTag)
  return { buffer: pdf, bodyEndY }
}

export async function applySignature(
  pdfBuffer: Buffer,
  signatureImage: Buffer,
  bodyEndY: number
): Promise<Buffer> {
  const pdfDoc = await PDFLib.load(pdfBuffer)
  const sig = await pdfDoc.embedPng(signatureImage)
  const pages = pdfDoc.getPages()
  const page = pages[pages.length - 1]
  const anchor = PDF_LAYOUT.signature
  page.drawImage(sig, {
    x: anchor.x,
    y: page.getHeight() - (bodyEndY + anchor.topGap) - anchor.height,
    width: anchor.width,
    height: anchor.height,
  })
  const out = await pdfDoc.save()
  return Buffer.from(out)
}

/** 乙方负责人手写签名图（个体户）：画在签署区右侧，与甲方签名同行 */
export async function applyPartyBSign(
  pdfBuffer: Buffer,
  signImage: Buffer,
  bodyEndY: number
): Promise<Buffer> {
  const pdfDoc = await PDFLib.load(pdfBuffer)
  const img = await pdfDoc.embedPng(signImage)
  const pages = pdfDoc.getPages()
  const page = pages[pages.length - 1]
  const anchor = PDF_LAYOUT.partyBSign
  page.drawImage(img, {
    x: page.getWidth() - anchor.fromRight - anchor.width,
    y: page.getHeight() - (bodyEndY + anchor.topGap) - anchor.height,
    width: anchor.width,
    height: anchor.height,
  })
  const out = await pdfDoc.save()
  return Buffer.from(out)
}
