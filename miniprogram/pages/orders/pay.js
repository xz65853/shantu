const { request } = require('../../utils/request')
const { yuan } = require('../../utils/format')

Page({
  onShareAppMessage() {
    const title = '闪途订单支付'
    return { title, path: '/pages/orders/pay' }
  },
  data: { orderNo: '', order: null, paying: false, loadFailed: false },
  onLoad(options) {
    this.setData({ orderNo: options.orderNo })
    this.load()
  },
  async load() {
    try {
      const order = await request({ url: '/api/miniapp/orders/' + this.data.orderNo })
      this.setData({ order: { ...order, amountText: yuan(order.amount) }, loadFailed: false })
    } catch (e) {
      // 加载失败必须让用户知道，并禁用支付按钮，避免「不知道在付什么」
      this.setData({ loadFailed: true })
      // 展示真实错误原因（如「请先签署合同」「订单已支付」），不再只报「网络错误」
      wx.showToast({ title: e.message || '订单加载失败', icon: 'none' })
    }
  },
  retryLoad() {
    this.load()
  },
  async pay() {
    // 防连点：只在有订单且未在支付中时允许发起
    if (this.data.paying) return
    if (!this.data.order) {
      wx.showToast({ title: '订单信息未加载', icon: 'none' })
      return
    }
    this.setData({ paying: true })
    try {
      const data = await request({
        url: '/api/payment/create',
        method: 'POST',
        data: { orderNo: this.data.orderNo, channel: 'wxpay', scene: 'mini', device: 'wechat' },
      })
      if (data.payType === 'jsapi' && data.jsapiParams) {
        const p = data.jsapiParams
        await new Promise((resolve, reject) => {
          wx.requestPayment({
            timeStamp: p.timeStamp,
            nonceStr: p.nonceStr,
            package: p.package,
            signType: p.signType || 'RSA',
            paySign: p.paySign,
            success: resolve,
            fail: reject,
          })
        })
        wx.showToast({ title: '支付成功', icon: 'success' })
        // 支付成功后跳订单详情页（会主动查单刷新真实支付状态）
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/orders/detail?orderNo=' + this.data.orderNo })
        }, 800)
      } else {
        wx.showToast({ title: '暂不支持当前支付方式', icon: 'none' })
      }
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else {
        // 展示真实错误（如签名失败、商户配置错误），不吞成「网络错误」
        const msg = (e && (e.message || e.errMsg)) || '支付失败'
        wx.showToast({ title: msg, icon: 'none', duration: 3000 })
      }
    } finally {
      this.setData({ paying: false })
    }
  },
})
