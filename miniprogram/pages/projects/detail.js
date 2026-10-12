const { request } = require('../../utils/request')
const { fmtDate } = require('../../utils/format')
const { buildWatermark } = require('../../utils/watermark')

const STATUS = { PENDING: '待开始', RUNNING: '进行中', PAUSED: '已暂停', DONE: '已完成' }

// 金额千分位格式化（GMV 展示 ¥1,234.00）
function fmtMoney(n) {
  const num = Number(n || 0)
  const parts = num.toFixed(2).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return '¥' + parts.join('.')
}

const dist = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

Page({
  onShareAppMessage() {
    const title = '项目详情'
    const q = function (o) { return (o.id ? '?id=' + o.id : '') }
    const query = q({ slug: this.slug, id: this.id }) || ''
    return { title, path: '/pages/projects/detail' + query }
  },
  data: {
    loading: true, p: null, tab: 'daily', reports: [], dailyLogs: [],
    wm: { enabled: false, backgroundImage: '' },
    preview: { visible: false, current: '', urls: [], scale: 1 },
  },
  onLoad(options) {
    this.id = options.id
    this.load()
  },
  // 拉取溯源水印配置（已登录 → 姓名+后4位+日期）
  // 拿到后端文案后，在本地重绘一张「更深、更密、双色」的瓦片（见 utils/watermark.js）
  async fetchWm() {
    try {
      const w = await request({ url: '/api/miniapp/watermark' })
      return buildWatermark(w)
    } catch (e) {
      return { enabled: false, backgroundImage: '', bgSize: 'auto' }
    }
  },
  async load() {
    try {
      const [p, wm] = await Promise.all([
        request({ url: '/api/miniapp/projects/' + this.id }),
        this.fetchWm(),
      ])
      const reports = (p.reports || []).map((r) => ({ ...r, gmvText: fmtMoney(r.gmv) }))
      this.setData({
        p: { ...p, statusText: STATUS[p.status] || p.status, startAt: fmtDate(p.startAt), endAt: fmtDate(p.endAt) },
        reports,
        dailyLogs: p.dailyLogs || [],
        wm,
        loading: false,
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },
  // 打开满屏预览（原生 wx.previewImage 无法叠水印，改用自研预览 + 顶部 fixed 水印覆盖）
  openPreview(e) {
    const urls = e.currentTarget.dataset.urls || []
    const current = e.currentTarget.dataset.current
    if (!current) return
    this.setData({ preview: { visible: true, current, urls, scale: 1 } })
  },
  closePreview() {
    this.setData({ 'preview.visible': false, 'preview.scale': 1 })
  },
  // 双指捏合缩放
  onTouchStart(e) {
    if (e.touches.length === 2) {
      this.startDist = dist(e.touches)
      this.startScale = this.data.preview.scale || 1
    }
  },
  onTouchMove(e) {
    if (e.touches.length === 2 && this.startDist) {
      const s = Math.min(4, Math.max(1, (this.startScale * dist(e.touches)) / this.startDist))
      this.setData({ 'preview.scale': Number(s.toFixed(3)) })
    }
  },
  onTouchEnd() {
    this.startDist = 0
  },
  // 双击切换 1x / 2x；单击关闭
  onStageTap() {
    const now = Date.now()
    if (now - (this.lastTap || 0) < 300) {
      clearTimeout(this.tapTimer)
      const cur = this.data.preview.scale || 1
      this.setData({ 'preview.scale': cur >= 2 ? 1 : 2 })
    } else {
      clearTimeout(this.tapTimer)
      this.tapTimer = setTimeout(() => this.closePreview(), 280)
    }
    this.lastTap = now
  },
  noop() {},
})
