const { trackPage } = require('../../utils/track')
const app = getApp()

trackPage({
  onShareAppMessage() {
    const title = '闪途 · 短视频代运营'
    return { title, path: '/pages/login/login' }
  },
  data: {
    agree: false,
    phoneCode: '', // 手机号授权 code（getPhoneNumber 返回）
    logging: false,
  },
  toggleAgree() {
    this.setData({ agree: !this.data.agree })
  },
  goAgreement(e) {
    const type = (e.currentTarget && e.currentTarget.dataset.type) || 'service'
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type })
  },
  /** 手机号授权（open-type=getPhoneNumber）：授权成功即一键登录 */
  onGetPhone(e) {
    const code = e.detail && e.detail.code
    if (!code) {
      wx.showToast({ title: '未授权手机号', icon: 'none' })
      return
    }
    this.setData({ phoneCode: code })
    this.doLogin(code)
  },
  async doLogin(phoneCode) {
    if (this.data.logging) return
    this.setData({ logging: true })
    wx.showLoading({ title: '登录中' })
    const r = await app.loginWithProfile({ phoneCode })
    wx.hideLoading()
    this.setData({ logging: false })
    if (r && r.ok) {
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        // 登录页可能在栈底（分享进入/冷启动直达），navigateBack 失败时兜底回首页
        wx.navigateBack({
          fail: () => wx.switchTab({ url: '/pages/mine/mine' }),
        })
      }, 800)
    } else {
      wx.showToast({ title: (r && r.message) || '登录失败，请重试', icon: 'none' })
    }
  },
})
