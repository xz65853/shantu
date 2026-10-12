const { trackPage } = require('../../utils/track')
const { request } = require('../../utils/request')
const { yuan } = require('../../utils/format')

trackPage({
  onShareAppMessage() {
    const title = '闪途 · 短视频代运营，让好内容跑出好生意'
    return { title, path: '/pages/index/index' }
  },
  onShareTimeline() {
    return { title: '闪途 · 短视频代运营，让好内容跑出好生意' }
  },
  data: {
    loading: true,
    member: null,
    site: {},
    home: {},
    services: [],
    serviceRows: [],
    cases: [],
    packages: [],
  },
  onLoad() {
    this.load()
  },
  onShow() {
    // 返回首页时刷新登录态
    const app = getApp()
    this.setData({ member: app.globalData.member || wx.getStorageSync('member') || null })
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },
  async load() {
    try {
      const data = await request({ url: '/api/miniapp/home', noAuth: true })
      const services = data.services || []
      this.setData({
        site: data.site || {},
        home: data.home || {},
        services,
        // 每行固定 2 个分组渲染：不依赖 flex-wrap/gap/calc，全机型都是竖两排
        serviceRows: this.chunkRows(services),
        cases: data.cases || [],
        // 分 → 元，带千分位；展示「¥1,999/月」
        packages: (data.packages || []).map((p) => ({ ...p, priceText: yuan(p.price) })),
        loading: false,
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  // 把列表按每行 2 个切成 [{key, items}] 结构
  chunkRows(list) {
    const rows = []
    for (let i = 0; i < list.length; i += 2) {
      rows.push({ key: rows.length, items: list.slice(i, i + 2) })
    }
    return rows
  },
  goService(e) {
    wx.navigateTo({ url: '/pages/services/detail?slug=' + e.currentTarget.dataset.slug })
  },
  goCase(e) {
    wx.navigateTo({ url: '/pages/cases/detail?slug=' + e.currentTarget.dataset.slug })
  },
  goPackages() {
    wx.switchTab({ url: '/pages/services/services' })
  },
  goServicesTab() {
    wx.switchTab({ url: '/pages/services/services' })
  },
  goCasesTab() {
    wx.switchTab({ url: '/pages/cases/cases' })
  },
  // 首页套餐直接进下单流程（订单页内含实名检查与手机号校验）
  goOrder(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/orders/orders?packageId=' + id })
  },
  goOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' })
  },
  goContracts() {
    wx.navigateTo({ url: '/pages/contract/contracts' })
  },
  // 免费预约 → 留资页（收集姓名/手机号/需求，提交到 /api/miniapp/leads）
  consult() {
    wx.navigateTo({ url: '/pages/lead/lead?source=home' })
  },
})
