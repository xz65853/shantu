// app.js
const { request, BASE_URL } = require('./utils/request')
const { startSession, endSession, flushQueue, getVisitId } = require('./utils/track')

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
    // 会话必须在 captureClickid 之后开启：渠道判定依赖 clickid
    startSession(options)
    // 补发上次未上报成功的会话
    flushQueue()
    // 冷启动时若已有登录态，把 clickid 关联到 openid
    if (this.globalData.token) this.bindClickid()
  },

  onShow(options) {
    // 热启动（从后台切回）也可能带新的启动参数
    this.captureClickid(options)
    startSession(options)
    if (this.globalData.token) this.bindClickid()
  },

  onHide() {
    // 切后台即结算本次会话（含最终停留时长）
    endSession()
  },

  /**
   * 从启动参数里取腾讯广告 clickid 并落 storage。
   * 来源有四种：
   *  - query.clickid / query.cid：落地页宏替换（腾讯广告 ADQ 后台配置）
   *  - query.gdt_vid：微信广告（朋友圈/公众号广告）自动透传的点击 ID，无需配置宏
   *  - query.gdt_clickid / query.qz_gdt：个别广告位的历史参数名，兼容保留
   *  - scene 场景值：广告跳转时形如 "ad-<clickid>"
   */
  captureClickid(options) {
    if (!options) return
    const query = options.query || {}
    let clickid = query.clickid || query.cid || query.gdt_vid || query.gdt_clickid || query.qz_gdt || ''

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

    // 拒绝未被替换的宏字面量（如 __CLICKID__），否则会把无效 ID 当真实点击上报
    if (/^__\w+__$/.test(clickid)) return

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
      // visit_id 把「广告点击」与「本次会话」绑定，
      // 解决原有实现只能归因到 openid、无法对应到具体访问流水的问题
      data: { clickid, visit_id: getVisitId() },
    })
      .then(() => wx.setStorageSync('clickid_bound_ok', clickid))
      .catch(() => wx.removeStorageSync('clickid_bound'))
  },
  /**
   * 登录（手机号授权，一键登录）。
   * @param {object} p { phoneCode, nickname }
   * @returns {Promise<{ok:boolean, message?:string}>}
   */
  loginWithProfile({ phoneCode, nickname }) {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          if (!res.code) return resolve({ ok: false, message: '微信登录失败' })
          request({
            url: '/api/miniapp/auth/login',
            method: 'POST',
            data: { code: res.code, phoneCode, nickname: nickname || '' },
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
                resolve({ ok: true })
              } else {
                resolve({ ok: false, message: '登录失败' })
              }
            })
            .catch((err) => resolve({ ok: false, message: (err && err.message) || '登录失败' }))
        },
        fail: () => resolve({ ok: false, message: '微信登录失败' }),
      })
    })
  },
  logout() {
    this.globalData.token = ''
    this.globalData.member = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('member')
  },

  /**
   * 实名前置校验：需要实名(required) 且 已开启实名能力(enabled) 且 未认证时，
   * 跳转实名页并返回 false（拦截当前操作）；否则返回 true（放行）。
   * @param {string} next 实名成功后回跳标识：'contract' / 'pay'
   * @param {string} orderNo 订单号（实名后回跳使用）
   */
  async ensureRealname(next, orderNo) {
    try {
      const s = await request({ url: '/api/miniapp/realname/status' })
      if (s && s.required && s.enabled && !s.isRealVerified) {
        // 先提示，用户确认后再跳实名页（实名完成后自动回跳）
        const go = await new Promise((resolve) => {
          wx.showModal({
            title: '需要实名认证',
            content: '签署合同前需先完成实名认证，是否现在去认证？',
            confirmText: '去认证',
            cancelText: '取消',
            success: (r) => resolve(!!r.confirm),
            fail: () => resolve(false),
          })
        })
        if (!go) return false
        wx.navigateTo({
          url: '/pages/realname/realname?next=' + (next || '') + '&orderNo=' + (orderNo || ''),
        })
        return false
      }
    } catch (e) {
      // 状态查询失败不阻塞（后端签署/支付接口仍有硬校验兜底）
    }
    return true
  },
})
