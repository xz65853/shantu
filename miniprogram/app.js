// app.js
const { request, BASE_URL } = require('./utils/request')

App({
  globalData: {
    token: '',
    member: null,
    site: null,
    clickid: '',
  },

  onLaunch(options) {
    this.globalData.token = wx.getStorageSync('token') || ''
    this.globalData.member = wx.getStorageSync('member') || null
    this.captureClickid(options)
    // 冷启动时若已有登录态，把 clickid 关联到 openid
    if (this.globalData.token) this.bindClickid()
  },

  onShow(options) {
    // 热启动（从后台切回）也可能带新的启动参数
    this.captureClickid(options)
    if (this.globalData.token) this.bindClickid()
  },

  /**
   * 从启动参数里取腾讯广告 clickid 并落 storage。
   * 来源有两种：
   *  - scene 场景值：广告跳转时形如 "ad-<clickid>"，或 query 里直接带 clickid
   *  - query：https://chenyi.ak03.cn/?from=tencent&clickid=xxx 唤起小程序时透传
   */
  captureClickid(options) {
    if (!options) return
    const query = options.query || {}
    let clickid = query.clickid || query.cid || ''

    // scene 解析：优先取 ad- 前缀后缀，其次取最后一段（腾讯广告常见格式）
    const scene = String(options.scene || query.scene || '')
    if (!clickid && scene) {
      const parts = scene.split('-')
      if (parts[0] === 'ad' && parts[1]) clickid = parts.slice(1).join('-')
      else if (/^[A-Za-z0-9_\-]{8,}$/.test(scene)) clickid = scene
    }

    clickid = String(clickid).trim().slice(0, 100)
    if (!clickid) return

    // 只接受腾讯广告来源，避免被任意参数污染
    if (query.from && query.from !== 'tencent') return

    wx.setStorageSync('clickid', clickid)
    wx.setStorageSync('ad_source', 'tencent')
    this.globalData.clickid = clickid
  },

  /** 读取已保存的 clickid（留资/下单时随请求带上） */
  getClickid() {
    return wx.getStorageSync('clickid') || this.globalData.clickid || ''
  },

  /** 上报 clickid，与后端记录的 openid 关联 */
  bindClickid() {
    const clickid = this.getClickid()
    if (!clickid || !this.globalData.token) return
    // 避免同一 clickid 反复上报
    if (wx.getStorageSync('clickid_bound') === clickid) return
    wx.setStorageSync('clickid_bound', clickid)

    request({
      url: '/api/ad/bind',
      method: 'POST',
      data: { clickid },
    })
      .then(() => wx.setStorageSync('clickid_bound_ok', clickid))
      .catch(() => wx.removeStorageSync('clickid_bound'))
  },
  // 静默登录：wx.login 拿 code 换 token
  silentLogin() {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          if (!res.code) return resolve(false)
          request({
            url: '/api/miniapp/auth/login',
            method: 'POST',
            data: { code: res.code },
            noAuth: true,
          })
            .then((data) => {
              if (data.token) {
                this.globalData.token = data.token
                this.globalData.member = data.member
                wx.setStorageSync('token', data.token)
                wx.setStorageSync('member', data.member)
                // 登录态就绪后再关联 clickid（此前 token 为空无法上报）
                this.bindClickid()
                resolve(true)
              } else {
                resolve(false)
              }
            })
            .catch(() => resolve(false))
        },
        fail: () => resolve(false),
      })
    })
  },
  logout() {
    this.globalData.token = ''
    this.globalData.member = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('member')
  },
})
