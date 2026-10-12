const { request, download, openFile } = require('../../utils/request')
const { fmtDateTime } = require('../../utils/format')

Page({
  onShareAppMessage() {
    const title = '我的合同'
    return { title, path: '/pages/contract/contracts' }
  },
  data: { loading: true, list: [], needLogin: false, busyId: 0 },
  onShow() {
    this.load()
  },
  async load() {
    try {
      const data = await request({ url: '/api/miniapp/contracts' })
      const list = (data.list || []).map((c) => ({
        ...c,
        signedAtText: c.signedAt ? fmtDateTime(c.signedAt) : '',
      }))
      this.setData({ list, loading: false, needLogin: false })
    } catch (e) {
      this.setData({ loading: false })
      if (e.code === 'UNAUTHORIZED') this.setData({ needLogin: true })
      else wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goView(e) {
    const { orderno, id } = e.currentTarget.dataset
    wx.navigateTo({
      url: '/pages/contract/sign?mode=view&orderNo=' + (orderno || '') + '&contractId=' + (id || ''),
    })
  },
  goSign(e) {
    const { orderno, id } = e.currentTarget.dataset
    if (orderno) wx.navigateTo({ url: '/pages/contract/sign?orderNo=' + orderno + '&contractId=' + (id || '') })
  },
  /**
   * 列表里直接下载合同 PDF
   * 小程序不能直接写进手机文件夹，先落盘到 USER_DATA_PATH（带 .pdf 后缀），
   * 再用 openDocument(showMenu) 打开 —— 用户点右上角「···」即可保存/转发。
   */
  async downloadPdf(e) {
    const { id } = e.currentTarget.dataset
    if (!id || this.data.busyId) return
    this.setData({ busyId: id })
    wx.showLoading({ title: '下载中', mask: true })
    try {
      const c = await request({ url: '/api/miniapp/contracts/' + id })
      // 走接口下载（后端返回的 pdfUrl=/uploads/... 静态路径未对外 serve，会 404）
      const url = '/api/miniapp/contracts/' + id + '/pdf'
      const name = c.contractNo || c.orderNo || 'contract'
      const filePath = await download(url, { saveAs: name + '.pdf' })
      wx.hideLoading()
      await openFile(filePath, 'pdf')
      wx.showToast({ title: '已下载，点右上角···可保存/转发', icon: 'none', duration: 2600 })
    } catch (err) {
      wx.hideLoading()
      if (err && err.code === 'UNAUTHORIZED') {
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 1200)
      } else {
        wx.showToast({ title: (err && err.message) || '下载失败', icon: 'none' })
      }
    } finally {
      this.setData({ busyId: 0 })
    }
  },
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
})
