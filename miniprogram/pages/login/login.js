const app = getApp()

Page({
  onShareAppMessage() {
    const title = '闪途 · 短视频代运营'
    return { title, path: '/pages/login/login' }
  },
  data: { agree: false },
  toggleAgree() {
    this.setData({ agree: !this.data.agree })
  },
  goAgreement(e) {
    const type = (e.currentTarget && e.currentTarget.dataset.type) || 'service'
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type })
  },
  async doLogin() {
    if (!this.data.agree) {
      wx.showToast({ title: '请先阅读并勾选同意协议', icon: 'none' })
      return
    }
    wx.showLoading({ title: '登录中' })
    const ok = await app.silentLogin()
    wx.hideLoading()
    if (ok) {
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        // 登录页可能在栈底（分享进入/冷启动直达），navigateBack 失败时兜底回首页
        wx.navigateBack({
          fail: () => wx.switchTab({ url: '/pages/mine/mine' }),
        })
      }, 1000)
    } else {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },
})
