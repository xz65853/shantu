const { request } = require('../../utils/request')

Page({
  onShareAppMessage() {
    const title = '闪途服务详情'
    const q = function (o) { return (o.slug ? '?slug=' + o.slug : '') }
    const query = q({ slug: this.slug, id: this.id }) || ''
    return { title, path: '/pages/services/detail' + query }
  },
  data: { loading: true, service: null },
  onLoad(options) {
    this.slug = options.slug
    this.load()
  },
  async load() {
    try {
      const service = await request({ url: '/api/miniapp/services/' + this.slug, noAuth: true })
      this.setData({ service, loading: false })
      wx.setNavigationBarTitle({ title: service.name || '服务详情' })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})
