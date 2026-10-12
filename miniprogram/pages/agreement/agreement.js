const { trackPage } = require('../../utils/track')
trackPage({
  onLoad(options) {
    // type: service=用户服务协议 privacy=隐私政策
    const type = options.type === 'privacy' ? 'privacy' : 'service'
    this.setData({ type })
    wx.setNavigationBarTitle({ title: type === 'privacy' ? '隐私政策' : '用户服务协议' })
  },
  onShareAppMessage() {
    return { title: '用户服务协议', path: '/pages/agreement/agreement?type=service' }
  },
  switchTab(e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.type) return
    this.setData({ type })
    wx.setNavigationBarTitle({ title: type === 'privacy' ? '隐私政策' : '用户服务协议' })
  },
  data: { type: 'service' },
})
