const { trackPage } = require('../../utils/track')
const { request } = require('../../utils/request')

const app = getApp()

trackPage({
  onShareAppMessage() {
    const title = '闪途 · 短视频代运营'
    return { title, path: '/pages/mine/mine' }
  },
  data: {
    member: null,
    realname: null,
    initial: '闪',
    stats: { projects: '-', orders: '-', contracts: '-' },
  },
  onShow() {
    this.load()
  },
  async load() {
    const member = app.globalData.member || wx.getStorageSync('member') || null
    this.setData({
      member,
      initial: member && member.nickname ? member.nickname[0] : '闪',
    })
    if (member) {
      this.loadRealname()
      this.loadStats()
    } else {
      this.setData({ realname: null, stats: { projects: '-', orders: '-', contracts: '-' } })
    }
  },
  async loadRealname() {
    try {
      const realname = await request({ url: '/api/miniapp/realname/status' })
      this.setData({ realname })
    } catch (e) {
      /* 未认证或接口异常不影响页面展示 */
    }
  },
  /** 顶部数据概览：三个列表接口各取条数，任一失败记为 0，不阻塞页面 */
  async loadStats() {
    const count = async (url) => {
      try {
        const d = await request({ url })
        return (d && d.list ? d.list.length : 0)
      } catch (e) {
        return 0
      }
    }
    const [projects, orders, contracts] = await Promise.all([
      count('/api/miniapp/projects'),
      count('/api/miniapp/orders'),
      count('/api/miniapp/contracts'),
    ])
    this.setData({ stats: { projects, orders, contracts } })
  },
  doLogin() {
    // 登录需授权手机号 + 头像，统一走登录页
    wx.navigateTo({ url: '/pages/login/login' })
  },
  /** 选择头像（open-type=chooseAvatar）回调：上传到自己服务器并回写会员资料 */
  async onChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl
    if (!tempPath) return
    wx.showLoading({ title: '上传中' })
    try {
      // 把临时文件上传到后端，后端存 uploads/avatars 并回写 member.avatar
      const data = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: 'https://chenyi.ak03.cn/api/miniapp/avatar/upload',
          filePath: tempPath,
          name: 'file',
          header: { Authorization: 'Bearer ' + (app.globalData.token || wx.getStorageSync('token') || '') },
          success: (res) => {
            try {
              const body = JSON.parse(res.data)
              if (body && body.code === 0 && body.data) resolve(body.data)
              else reject({ message: (body && body.message) || '上传失败' })
            } catch (e) {
              reject({ message: '上传响应异常' })
            }
          },
          fail: () => reject({ message: '上传失败，请检查网络' }),
        })
      })
      wx.hideLoading()
      // 更新本地 member 头像（自己域名 URL），刷新后仍存在
      const url = data.avatar || data.url
      if (!url) {
        wx.showToast({ title: '上传失败', icon: 'none' })
        return
      }
      const member = { ...(this.data.member || {}), avatar: url }
      this.setData({ member })
      app.globalData.member = member
      wx.setStorageSync('member', member)
      wx.showToast({ title: '头像已更新', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '上传失败', icon: 'none' })
    }
  },
  goOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' })
  },
  goContracts() {
    wx.navigateTo({ url: '/pages/contract/contracts' })
  },
  goRealname() {
    wx.navigateTo({ url: '/pages/realname/realname' })
  },
  goProjects() {
    wx.switchTab({ url: '/pages/projects/projects' })
  },
  goServices() {
    wx.switchTab({ url: '/pages/services/services' })
  },
  goLead() {
    wx.navigateTo({ url: '/pages/lead/lead?source=mine' })
  },
  goAgreement(e) {
    const type = (e.currentTarget && e.currentTarget.dataset.type) || 'service'
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type })
  },
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          this.setData({
            member: null,
            realname: null,
            stats: { projects: '-', orders: '-', contracts: '-' },
          })
        }
      },
    })
  },
})
