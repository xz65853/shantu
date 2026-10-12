const { request } = require('../../utils/request')
const { buildWatermark } = require('../../utils/watermark')

const dist = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

Page({
  onShareAppMessage() {
    const title = '闪途案例详情'
    const q = function (o) { return (o.slug ? '?slug=' + o.slug : '') }
    const query = q({ slug: this.slug, id: this.id }) || ''
    return { title, path: '/pages/cases/detail' + query }
  },
  data: {
    loading: true,
    c: null,
    wm: { enabled: false, backgroundImage: '' },
    preview: { visible: false, current: '', urls: [], scale: 1 },
  },
  onLoad(options) {
    this.slug = options.slug
    this.load()
  },
  // 拉取溯源水印配置：已登录自动带 token（显示姓名+后4位+日期），未登录返回「演示数据」
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
      const [c, wm] = await Promise.all([
        request({ url: '/api/miniapp/cases/' + this.slug, noAuth: true }),
        this.fetchWm(),
      ])
      this.setData({ c, wm, loading: false })
      wx.setNavigationBarTitle({ title: c.title || '案例详情' })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
  // 相关案例 → 跳的是本页自身，用 redirectTo 替换当前页，避免页面栈无限叠加
  goCase(e) {
    const slug = e.currentTarget.dataset.slug
    if (!slug) return
    wx.redirectTo({ url: '/pages/cases/detail?slug=' + slug })
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
