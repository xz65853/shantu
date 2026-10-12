const { request } = require('../../utils/request')
const { yuan } = require('../../utils/format')

const app = getApp()

const STATUS = {
  PENDING: '待支付',
  PAYING: '支付中',
  PAID: '已支付',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  COMPLETED: '已完成',
}

Page({
  onShareAppMessage() {
    const title = '我的订单'
    return { title, path: '/pages/orders/orders' }
  },
  data: {
    loading: true,
    list: [],
    needLogin: false,
    orderPackage: null,
    submitting: false,
    // 会员资料：下单时自动带出姓名（昵称/实名姓名）与手机号，无需手填
    member: null,
    hasPhone: false,
    needPhone: false, // 未绑定手机号时，展示「获取手机号」授权按钮
    // SKU 规格
    skus: [],
    selectedSkuId: null,
    selectedSku: null,
    // 当前展示的服务内容：优先用所选 SKU 的，SKU 未配置时回退套餐服务内容
    showFeatures: [],
    hasSkuFeatures: false,
  },
  onLoad(options) {
    this.packageId = options.packageId ? Number(options.packageId) : 0
    if (this.packageId) this.loadPackage()
    else this.loadList()
  },
  onShow() {
    if (!this.packageId) this.loadList()
    if (this.packageId) this.refreshMember()
  },
  /** 刷新登录态与会员资料（下单前依赖 hasPhone / nickname） */
  refreshMember() {
    const member = app.globalData.member || wx.getStorageSync('member') || null
    this.setData({
      member,
      hasPhone: !!(member && member.hasPhone),
      needPhone: false,
    })
  },
  async loadPackage() {
    try {
      const data = await request({ url: '/api/packages', noAuth: true })
      const list = data.list || data || []
      const pkg = list.find((p) => p.id === this.packageId)
      if (pkg) {
        const features = pkg.features || []
        const skus = (pkg.skus || []).map((s) => ({
          ...s,
          yuan: yuan(s.price),
          originalYuan: s.originalPrice ? yuan(s.originalPrice) : '',
          saveYuan: s.originalPrice && s.originalPrice > s.price ? yuan(s.originalPrice - s.price) : '',
        }))
        const first = skus[0] || null
        this.setData({
          orderPackage: { ...pkg, yuan: yuan(pkg.minPrice != null ? pkg.minPrice : pkg.price), features },
          skus,
          selectedSkuId: first ? first.id : null,
          selectedSku: first,
          loading: false,
        })
        this.applyFeatures(first, features)
        this.refreshMember()
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: '套餐不存在或已下架', icon: 'none' })
      }
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '套餐加载失败', icon: 'none' })
    }
  },
  /** 服务内容按所选 SKU 切换：SKU 配了就用 SKU 的，否则沿用套餐的 */
  applyFeatures(sku, pkgFeatures) {
    const pkg = this.data.orderPackage || {}
    const fallback = pkgFeatures || pkg.features || []
    const own = (sku && sku.features) || []
    const list = own.length ? own : fallback
    this.setData({ showFeatures: list, hasSkuFeatures: own.length > 0 })
  },
  /** 选择 SKU 规格 */
  selectSku(e) {
    const id = e.currentTarget.dataset.id
    const sku = this.data.skus.find((s) => s.id === id)
    if (sku) {
      this.setData({ selectedSkuId: id, selectedSku: sku })
      const pkg = this.data.orderPackage || {}
      this.applyFeatures(sku, pkg.features || [])
    }
  },
  async loadList() {
    try {
      const data = await request({ url: '/api/miniapp/orders' })
      const list = (data.list || []).map((o) => ({ ...o, amountText: yuan(o.amount), statusText: STATUS[o.status] || o.status }))
      this.setData({ list, loading: false, needLogin: false })
    } catch (e) {
      this.setData({ loading: false })
      if (e.code === 'UNAUTHORIZED') this.setData({ needLogin: true })
    }
  },
  /** 微信手机号授权（open-type=getPhoneNumber）回调：绑定手机号后自动下单 */
  async onGetPhone(e) {
    const code = e.detail && e.detail.code
    if (!code) {
      wx.showToast({ title: '未授权手机号', icon: 'none' })
      return
    }
    wx.showLoading({ title: '绑定中' })
    try {
      const res = await request({ url: '/api/miniapp/auth/phone', method: 'POST', data: { code } })
      // 绑定成功：更新本地 member 手机号（phone 已写入后端，无需重新登录）
      const member = { ...(app.globalData.member || {}), phone: (res && res.phone) || '', hasPhone: true }
      app.globalData.member = member
      wx.setStorageSync('member', member)
      this.refreshMember()
      wx.hideLoading()
      this.submit()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '手机号绑定失败', icon: 'none' })
    }
  },
  /** 下单：会员资料自动带出姓名/手机号，无需手填 */
  async submit() {
    if (this.data.submitting) return

    // 1) 确保已登录
    const token = app.globalData.token || wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    this.refreshMember()

    // 2) 姓名：昵称 / 实名姓名 兜底；手机号：member.phone
    const member = this.data.member || {}
    const name = (member.nickname || member.name || '').trim()
    const phone = (member.phone || '').trim()

    // 未绑定手机号 → 引导微信手机号授权（不能静默下单，后端强制校验 phone）
    if (!phone) {
      this.setData({ needPhone: true })
      wx.showToast({ title: '请先授权手机号', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const data = await request({
        url: '/api/miniapp/orders',
        method: 'POST',
        data: {
          packageId: this.packageId,
          skuId: this.data.selectedSkuId || undefined,
          name: name || '微信用户',
          phone,
          // 广告归因：腾讯广告 clickid（普通用户为空，后端忽略）
          clickid: getApp().getClickid(),
          adSource: wx.getStorageSync('ad_source') || 'tencent',
        },
      })
      wx.showLoading({ title: '下单成功' })
      wx.hideLoading()
      // 下单成功 → 按实名状态路由（对齐原版流程：下单→(实名)→合同签署→自动支付）
      this.routeAfterSubmit(data.orderNo)
    } catch (e) {
      wx.showToast({ title: e.message || '下单失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
  /** 下单后按实名状态路由：需实名且未认证 → 实名页；否则 → 合同签署页 */
  async routeAfterSubmit(orderNo) {
    if (!orderNo) {
      wx.showToast({ title: '下单异常，请联系客服', icon: 'none' })
      return
    }
    try {
      const s = await request({ url: '/api/miniapp/realname/status' })
      if (s.required && !s.isRealVerified) {
        wx.redirectTo({
          url: '/pages/realname/realname?next=contract&orderNo=' + orderNo,
          fail: () => this.goSign(orderNo),
        })
        return
      }
    } catch (e) {
      /* 实名状态查询失败不阻塞，直接进签署页 */
    }
    this.goSign(orderNo)
  },
  goSign(orderNo) {
    wx.redirectTo({
      url: '/pages/contract/sign?mode=sign&orderNo=' + orderNo,
      fail: () => wx.showToast({ title: '跳转失败，请到「我的合同」查看', icon: 'none' }),
    })
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/orders/detail?orderNo=' + e.currentTarget.dataset.orderno })
  },
  goPay(e) {
    wx.navigateTo({ url: '/pages/orders/pay?orderNo=' + e.currentTarget.dataset.orderno })
  },
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
})
