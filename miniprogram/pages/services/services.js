const { trackPage } = require('../../utils/track')
const { request, absUrl } = require('../../utils/request')
const { yuan } = require('../../utils/format')

trackPage({
  onShareAppMessage() {
    const title = '闪途服务 · 短视频代运营套餐'
    return { title, path: '/pages/services/services' }
  },
  data: {
    loading: true,
    services: [],
    packages: [],
  },
  onLoad() {
    this.load()
  },
  async load() {
    try {
      const [svc, pkg] = await Promise.all([
        request({ url: '/api/miniapp/services', noAuth: true }),
        request({ url: '/api/packages', noAuth: true }),
      ])
      const packages = (pkg.list || pkg || []).map((p) => ({
        ...p,
        yuan: yuan(p.minPrice != null ? p.minPrice : p.price),
        coverUrl: p.cover ? absUrl(p.cover) : '',
        skuCount: (p.skus || []).length,
      }))
      this.setData({ services: svc.services || svc || [], packages, loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/services/detail?slug=' + e.currentTarget.dataset.slug })
  },
  /** 点「立即购买」：跳下单页（原模板：会员资料自动带出姓名手机号，无需手填） */
  goOrder(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/orders/orders?packageId=' + id })
  },
})
