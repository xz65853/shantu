const { trackPage } = require('../../utils/track')
const { request } = require('../../utils/request')
const { yuan, fmtDateTime, maskPhone } = require('../../utils/format')

const app = getApp()

const STATUS = {
  PENDING: { text: '待支付', sub: '请尽快完成支付，顾问将在支付后与您对接服务' },
  PAYING: { text: '支付中', sub: '支付处理中，请稍候' },
  PAID: { text: '已支付', sub: '支付成功，顾问将在 24 小时内联系您' },
  COMPLETED: { text: '已完成', sub: '服务已完成，感谢您的信任' },
  CANCELLED: { text: '已取消', sub: '订单已取消' },
  REFUNDING: { text: '退款中', sub: '退款处理中' },
  REFUNDED: { text: '已退款', sub: '订单已退款' },
}

trackPage({
  onShareAppMessage() {
    return { title: '订单详情', path: '/pages/orders/orders' }
  },
  data: {
    orderNo: '',
    order: null,
    statusInfo: null,
    signed: false,
    contractChecked: false,
    loading: true,
    loadFailed: false,
    paying: false,
    needLogin: false,
  },
  onLoad(options) {
    this.setData({ orderNo: options.orderNo || '' })
    this.load(true)
  },
  onShow() {
    // 从签署页/支付页返回时刷新订单状态
    if (this.data.orderNo && !this.data.loading) this.load(false)
  },
  async load(refresh) {
    const token = app.globalData.token || wx.getStorageSync('token')
    if (!token) {
      this.setData({ loading: false, needLogin: true })
      return
    }
    try {
      const url = '/api/miniapp/orders/' + this.data.orderNo + (refresh ? '?refresh=1' : '')
      const order = await request({ url })
      const statusInfo = STATUS[order.status] || { text: order.status, sub: '' }
      this.setData({
        order: {
          ...order,
          amountText: yuan(order.amount),
          createdAtText: fmtDateTime(order.createdAt),
          paidAtText: fmtDateTime(order.paidAt),
          phoneMask: maskPhone(order.phone),
          summary: (order.package && order.package.summary) || '',
        },
        statusInfo,
        loading: false,
        loadFailed: false,
      })
      this.loadContract()
    } catch (e) {
      this.setData({ loading: false, loadFailed: true })
      if (e.code === 'UNAUTHORIZED') this.setData({ needLogin: true })
      else wx.showToast({ title: e.message || '订单加载失败', icon: 'none' })
    }
  },
  async loadContract() {
    try {
      const c = await request({ url: '/api/miniapp/orders/' + this.data.orderNo + '/contract' })
      this.setData({ signed: c.status === 'SIGNED', contractChecked: true })
    } catch (e) {
      // 合同查询失败不阻塞详情展示（如订单无套餐合同）
      this.setData({ contractChecked: true, signed: false })
    }
  },
  retry() {
    this.setData({ loading: true, loadFailed: false })
    this.load(true)
  },
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
  /** 签署合同 */
  async goSign() {
    const ok = await app.ensureRealname('contract', this.data.orderNo)
    if (!ok) return
    wx.navigateTo({ url: '/pages/contract/sign?mode=sign&orderNo=' + this.data.orderNo })
  },
  /** 查看合同 */
  goViewContract() {
    wx.navigateTo({ url: '/pages/contract/sign?mode=view&orderNo=' + this.data.orderNo })
  },
  /** 立即支付 */
  async goPay() {
    const ok = await app.ensureRealname('pay', this.data.orderNo)
    if (!ok) return
    wx.navigateTo({ url: '/pages/orders/pay?orderNo=' + this.data.orderNo })
  },
})
