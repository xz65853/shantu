const { request } = require('../../utils/request')

const STATUS = { PENDING: '待开始', RUNNING: '进行中', PAUSED: '已暂停', DONE: '已完成' }

Page({
  onShareAppMessage() {
    const title = '我的项目 · 闪途代运营'
    return { title, path: '/pages/projects/projects' }
  },
  data: { loading: true, list: [], needLogin: false },
  onShow() {
    this.load()
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },
  async load() {
    try {
      const data = await request({ url: '/api/miniapp/projects' })
      const list = (data.list || []).map((p) => ({ ...p, statusText: STATUS[p.status] || p.status }))
      this.setData({ list, loading: false, needLogin: false })
    } catch (e) {
      this.setData({ loading: false })
      if (e.code === 'UNAUTHORIZED') this.setData({ needLogin: true })
    }
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/projects/detail?id=' + e.currentTarget.dataset.id })
  },
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
})
