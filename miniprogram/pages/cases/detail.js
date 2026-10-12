const { trackPage } = require('../../utils/track')
const { request } = require('../../utils/request')
const { buildWatermark } = require('../../utils/watermark')

trackPage({
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
  // 图片预览：用微信原生 wx.previewImage（流畅、原生支持左右滑动 + 双指/双击缩放）
  openPreview(e) {
    let urls = e.currentTarget.dataset.urls || []
    const current = e.currentTarget.dataset.current
    if (!current) return
    // 若当前图不在列表里（如封面不在 gallery），补到最前，保证「点封面打开封面」
    if (!urls.includes(current)) urls = [current, ...urls]
    wx.previewImage({ current, urls })
  },
})
