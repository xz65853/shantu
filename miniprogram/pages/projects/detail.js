const { trackPage } = require('../../utils/track')
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

trackPage({
  onShareAppMessage() {
    const title = '项目详情'
    const q = function (o) { return (o.id ? '?id=' + o.id : '') }
    const query = q({ slug: this.slug, id: this.id }) || ''
    return { title, path: '/pages/projects/detail' + query }
  },
  data: {
    loading: true, p: null, tab: 'daily', reports: [], dailyLogs: [],
    wm: { enabled: false, backgroundImage: '' },
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
  // 图片预览：用微信原生 wx.previewImage（流畅、原生支持左右滑动 + 双指/双击缩放）
  openPreview(e) {
    let urls = e.currentTarget.dataset.urls || []
    const current = e.currentTarget.dataset.current
    if (!current) return
    // 若当前图不在列表里，补到最前，保证点哪张打开哪张
    if (!urls.includes(current)) urls = [current, ...urls]
    wx.previewImage({ current, urls })
  },
})
