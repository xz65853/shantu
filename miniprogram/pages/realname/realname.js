const { request } = require('../../utils/request')

Page({
  onShareAppMessage() {
    const title = '实名认证'
    return { title, path: '/pages/realname/realname' }
  },
  data: { loading: true, status: null, name: '', idCard: '', submitting: false, agree: false },
  toggleAgree() {
    this.setData({ agree: !this.data.agree })
  },
  goAgreement(e) {
    const type = (e.currentTarget && e.currentTarget.dataset.type) || 'service'
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type })
  },
  onLoad(options) {
    // 下单流程跳入时带 next=contract&orderNo，认证成功后回跳合同签署页
    this.next = options.next || ''
    this.orderNo = options.orderNo || ''
  },
  // onShow 首次进入也会触发，onLoad 里不用重复请求
  onShow() {
    this.load()
  },
  /** 认证成功后回跳：下单流程回合同签署页，否则回上一页 */
  finish() {
    if (this.next === 'contract' && this.orderNo) {
      wx.redirectTo({
        url: '/pages/contract/sign?mode=sign&orderNo=' + this.orderNo,
      })
    } else {
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mine/mine' }) })
    }
  },
  async load() {
    try {
      const status = await request({ url: '/api/miniapp/realname/status' })
      this.setData({ status, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onIdCard(e) {
    this.setData({ idCard: e.detail.value })
  },
  async submit() {
    if (this.data.submitting) return // 防连点，避免重复发起认证
    if (!this.data.agree) {
      wx.showToast({ title: '请先阅读并勾选同意协议', icon: 'none' })
      return
    }
    const { name, idCard } = this.data
    if (name.trim().length < 2) {
      wx.showToast({ title: '请填写真实姓名', icon: 'none' })
      return
    }
    if (!/^\d{17}[\dXx]$/.test(idCard)) {
      wx.showToast({ title: '身份证号格式不正确', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const res = await request({
        url: '/api/miniapp/realname/start',
        method: 'POST',
        data: { name: name.trim(), idCard },
      })
      if (res.verified) {
        wx.showToast({ title: '认证成功', icon: 'success' })
        setTimeout(() => this.finish(), 600)
      } else if (res.channel === 'wechat_face') {
        this.doFaceVerify(res.verifyId, res.outSeqNo)
      } else {
        wx.showToast({ title: '发起认证失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: e.message || '认证失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
  doFaceVerify(verifyId, outSeqNo) {
    // 人脸核身要求较高版本基础库，低版本上该 API 不存在，需显式降级提示
    if (typeof wx.requestFacialVerify !== 'function') {
      wx.showModal({
        title: '需要升级微信',
        content: '当前微信版本过低，无法进行人脸核身。请将微信升级到最新版本后重试。',
        showCancel: false,
      })
      return
    }
    wx.requestFacialVerify({
      verifyId,
      success: async () => {
        try {
          await request({ url: '/api/miniapp/realname/confirm', method: 'POST', data: { verifyId, outSeqNo } })
          wx.showToast({ title: '认证成功', icon: 'success' })
          setTimeout(() => this.finish(), 600)
        } catch (e) {
          wx.showToast({ title: e.message || '认证失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '人脸核身未通过', icon: 'none' })
      },
    })
  },
})
