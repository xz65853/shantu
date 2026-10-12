const { request } = require('../../utils/request')
const { trackPage, markLead } = require('../../utils/track')

const PHONE_RE = /^1[3-9]\d{9}$/

trackPage({
  onShareAppMessage() {
    const title = '免费预约 · 闪途短视频代运营'
    return { title, path: '/pages/lead/lead' }
  },
  data: {
    loading: true,
    submitting: false,
    done: false,
    notice: '',
    site: {},
    services: [], // 业务标签（来自首页接口）
    name: '',
    phone: '',
    company: '',
    remark: '',
    pickedCount: 0,
  },

  onLoad(options) {
    this.source = options.source || 'home'
    this.loadMeta()
    this.prefill()
  },

  // 拉取站点信息（微信二维码 / 公告）与业务标签
  async loadMeta() {
    try {
      const data = await request({ url: '/api/miniapp/home', noAuth: true })
      const services = (data.services || []).map((s) => ({ id: s.id, name: s.name, selected: false }))
      this.setData({
        site: data.site || {},
        notice: (data.home && data.home.notice) || '',
        services,
        loading: false,
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  // 已登录会员自动带出姓名/手机，减少填写成本
  prefill() {
    try {
      const app = getApp()
      const member = (app && app.globalData && app.globalData.member) || wx.getStorageSync('member') || null
      if (!member) return
      const patch = {}
      if (member.name) patch.name = member.name
      if (member.realName) patch.name = member.realName
      if (member.phone) patch.phone = member.phone
      if (Object.keys(patch).length) this.setData(patch)
    } catch (e) {
      /* 忽略 */
    }
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },
  onCompany(e) {
    this.setData({ company: e.detail.value })
  },
  onRemark(e) {
    this.setData({ remark: e.detail.value })
  },
  toggleService(e) {
    const i = Number(e.currentTarget.dataset.index)
    this.setData({
      ['services[' + i + '].selected']: !this.data.services[i].selected,
      pickedCount: this.data.services.filter((s, idx) => (idx === i ? !this.data.services[i].selected : s.selected)).length,
    })
  },

  /** 微信一键获取手机号；后端若无解密接口则静默降级为手动填写 */
  async onGetPhone(e) {
    const code = e.detail && e.detail.code
    if (!code) {
      if (e.detail && e.detail.errMsg && e.detail.errMsg.indexOf('deny') < 0) {
        wx.showToast({ title: '获取失败，请手动输入', icon: 'none' })
      }
      return
    }
    try {
      const data = await request({ url: '/api/miniapp/auth/phone', method: 'POST', data: { code } })
      const phone = (data && (data.phone || data.phoneNumber)) || ''
      if (phone) {
        this.setData({ phone })
        wx.showToast({ title: '已填入手机号', icon: 'none' })
      } else {
        wx.showToast({ title: '请手动输入手机号', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '请手动输入手机号', icon: 'none' })
    }
  },

  async submit() {
    if (this.data.submitting) return
    const name = (this.data.name || '').trim()
    const phone = (this.data.phone || '').trim()

    if (name.length < 2) {
      wx.showToast({ title: '请填写真实姓名', icon: 'none' })
      return
    }
    if (!PHONE_RE.test(phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' })
      return
    }

    const picked = (this.data.services || []).filter((s) => s.selected).map((s) => s.name)

    this.setData({ submitting: true })
    try {
      await request({
        url: '/api/miniapp/leads',
        method: 'POST',
        data: {
          name,
          phone,
          company: (this.data.company || '').trim(),
          service: picked.join('、'),
          remark: (this.data.remark || '').trim(),
          source: this.source,
          // 广告归因：腾讯广告 clickid（普通用户为空，后端忽略）
          clickid: getApp().getClickid(),
          adSource: wx.getStorageSync('ad_source') || 'tencent',
        },
      })
      wx.setStorageSync('leadSubmitted', '1')
      // 留资转化：立即上报，避免用户提交后直接退出导致本次会话漏记 is_lead
      markLead()
      this.setData({ done: true, submitting: false })
      wx.showToast({ title: '预约成功', icon: 'success' })
    } catch (e) {
      this.setData({ submitting: false })
      wx.showToast({ title: e.message || '提交失败，请稍后重试', icon: 'none' })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },
  reset() {
    this.setData({
      done: false,
      company: '',
      remark: '',
      services: this.data.services.map((s) => ({ ...s, selected: false })),
      pickedCount: 0,
    })
  },
  previewQr() {
    const url = this.data.site.wechatQrcode
    if (!url) return
    wx.previewImage({ urls: [url], current: url })
  },
})
