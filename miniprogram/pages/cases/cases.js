const { request } = require('../../utils/request')

Page({
  onShareAppMessage() {
    const title = '闪途案例 · 我们的代运营成果'
    return { title, path: '/pages/cases/cases' }
  },
  data: { loading: true, list: [] },
  onLoad() {
    this.load()
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },
  async load() {
    try {
      const data = await request({ url: '/api/miniapp/cases', noAuth: true })
      this.setData({ list: data.list || [], loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/cases/detail?slug=' + e.currentTarget.dataset.slug })
  },
})
