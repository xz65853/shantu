const { trackPage } = require('../../utils/track')
const { request, download, openFile } = require('../../utils/request')
const { fmtDateTime } = require('../../utils/format')

trackPage({
  onShareAppMessage() {
    const title = '闪途合同签署'
    return { title, path: '/pages/contract/sign' }
  },
  data: {
    orderNo: '',
    contractId: '',
    mode: 'sign', // sign=签署（默认） / view=查看
    contract: null,
    signing: false,
    paying: false,
    pdfBusy: false,
    pdfReady: false, // PDF 是否已成功下载到本地
    fullSign: { visible: false }, // 全屏签名弹层
    signatureDataUrl: '', // 最终签名图（全屏签名确认后优先使用）
    signPreviewUrl: '', // 签名预览图（全屏签名确认后回填展示在签署页）
  },
  onLoad(options) {
    this.setData({
      orderNo: options.orderNo || '',
      contractId: options.contractId || '',
      mode: options.mode === 'view' ? 'view' : 'sign',
    })
    // 签署模式：未实名先跳实名（防从合同列表/分享直链绕过实名进入签署页）
    if (this.data.mode === 'sign') this.checkRealnameBeforeSign()
    this.loadContract()
  },
  async checkRealnameBeforeSign() {
    try {
      const s = await request({ url: '/api/miniapp/realname/status' })
      if (s && s.required && s.enabled && !s.isRealVerified) {
        wx.showModal({
          title: '需要实名认证',
          content: '签署合同前需先完成实名认证，是否现在去认证？',
          confirmText: '去认证',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm) {
              wx.redirectTo({ url: '/pages/realname/realname?next=contract&orderNo=' + (this.data.orderNo || '') })
            }
          },
        })
      }
    } catch (e) {
      /* 查询失败不阻塞，后端签署接口仍有硬校验兜底 */
    }
  },
  onReady() {
    // 画布包裹在 wx:if 里，此时 contract 可能还没回来，真正初始化在 loadContract 之后
    if (this.data.mode === 'sign' && this.data.contract) this.initCanvas()
  },
  async loadContract() {
    // 优先按 orderNo 加载（下单后路由进签署页只带 orderNo）；否则按 contractId
    if (!this.data.orderNo && !this.data.contractId) {
      wx.showToast({ title: '缺少合同参数', icon: 'none' })
      return
    }
    try {
      // 下单后进入本页时只有 orderNo，走「按订单取合同」接口；合同列表/详情进入时有 contractId
      const url = this.data.orderNo
        ? '/api/miniapp/orders/' + this.data.orderNo + '/contract'
        : '/api/miniapp/contracts/' + this.data.contractId
      const c = await request({ url })
      const contract = { ...c, signedAtText: c.signedAt ? fmtDateTime(c.signedAt) : '' }
      // 若按 orderNo 加载，回填 contractId 供后续下载签名/PDF 使用
      if (!this.data.contractId && c.id) this.setData({ contractId: c.id })
      // setData 回调里再初始化画布：只有这时 wx:if 的 canvas 节点才真正存在
      this.setData({ contract }, () => {
        if (this.data.mode === 'sign' && contract.status === 'PENDING') {
          wx.nextTick(() => this.initCanvas())
        }
      })
      // 已签署即展示客户自己的签名（我方公章/签字仍按付款状态控制，见下方提示）
      if (c.status === 'SIGNED' && c.signatureImageUrl) {
        try {
          const p = await download('/api/miniapp/contracts/' + c.id + '/signature')
          this.setData({ 'contract.signatureLocal': p })
        } catch {
          /* 签名图加载失败不影响合同查看 */
        }
      }
    } catch (e) {
      wx.showToast({ title: e.message || '合同加载失败', icon: 'none' })
    }
  },
  /** 初始化手写签名画布，返回 Promise<boolean> */
  initCanvas() {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .select('#signCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return resolve(false)
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          ctx.strokeStyle = '#1a1a1a'
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          this.canvas = canvas
          this.ctx = ctx
          this.canvasWidth = res[0].width
          this.canvasHeight = res[0].height
          resolve(true)
        })
    })
  },
  onTouchStart(e) {
    if (!this.ctx) return
    const t = e.touches[0]
    this.drawing = true
    this.ctx.beginPath()
    this.ctx.moveTo(t.x, t.y)
  },
  onTouchMove(e) {
    if (!this.drawing || !this.ctx) return
    const t = e.touches[0]
    this.ctx.lineTo(t.x, t.y)
    this.ctx.stroke()
  },
  onTouchEnd() {
    this.drawing = false
  },
  clear() {
    if (!this.ctx) {
      wx.showToast({ title: '签名板未就绪', icon: 'none' })
      return
    }
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    this.setData({ signatureDataUrl: '', signPreviewUrl: '' })
  },
  // 重签：清掉全屏签名预览，回到手写签名板
  clearSignPreview() {
    this.setData({ signatureDataUrl: '', signPreviewUrl: '' })
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
  },

  // ===== 全屏签名 =====
  openFullSign() {
    this.setData({ 'fullSign.visible': true }, () => {
      wx.nextTick(() => this.initFullCanvas())
    })
  },
  closeFullSign() {
    this.setData({ 'fullSign.visible': false })
  },
  initFullCanvas() {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .select('#fullSignCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return resolve(false)
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          ctx.strokeStyle = '#1a1a1a'
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          this.fullCanvas = canvas
          this.fullCtx = ctx
          this.fullCanvasWidth = res[0].width
          this.fullCanvasHeight = res[0].height
          resolve(true)
        })
    })
  },
  onFullTouchStart(e) {
    if (!this.fullCtx) return
    const t = e.touches[0]
    this.fullDrawing = true
    this.fullCtx.beginPath()
    this.fullCtx.moveTo(t.x, t.y)
  },
  onFullTouchMove(e) {
    if (!this.fullDrawing || !this.fullCtx) return
    const t = e.touches[0]
    this.fullCtx.lineTo(t.x, t.y)
    this.fullCtx.stroke()
  },
  onFullTouchEnd() {
    this.fullDrawing = false
  },
  clearFullSign() {
    if (!this.fullCtx) return
    this.fullCtx.clearRect(0, 0, this.fullCanvasWidth, this.fullCanvasHeight)
  },
  confirmFullSign() {
    if (!this.fullCanvas) {
      wx.showToast({ title: '签名板未就绪', icon: 'none' })
      return
    }
    const dataUrl = this.fullCanvas.toDataURL('image/png')
    // 判断是否真签了字：用像素简单判断（这里直接接受，由后端/展示兜底）
    this.setData({ signatureDataUrl: dataUrl, signPreviewUrl: dataUrl, 'fullSign.visible': false })
    wx.showToast({ title: '签名已就绪', icon: 'none' })
  },

  async submit() {
    if (this.data.signing) return
    let dataUrl = this.data.signatureDataUrl
    if (!dataUrl) {
      // 兜底：小签名板
      if (!this.canvas) await this.initCanvas()
      if (!this.canvas) {
        wx.showToast({ title: '签名组件未就绪，请返回重试', icon: 'none' })
        return
      }
      dataUrl = this.canvas.toDataURL('image/png')
    }
    this.setData({ signing: true })
    try {
      await request({
        url: '/api/miniapp/orders/' + this.data.orderNo + '/contract/sign',
        method: 'POST',
        data: { signature: dataUrl },
      })
      wx.showToast({ title: '签署成功', icon: 'success' })
      this.setData({ signing: false, 'contract.status': 'SIGNED' })
      // 签署成功 → 自动调起微信支付（对齐原版流程：签署后直接付款）
      setTimeout(() => this.goPay(), 600)
    } catch (e) {
      wx.showToast({ title: e.message || '签署失败', icon: 'none' })
      this.setData({ signing: false })
    }
  },

  /** 签署后自动发起支付 */
  async goPay() {
    if (this.data.paying) return
    if (!this.data.orderNo) {
      wx.showToast({ title: '缺少订单号，请到「我的订单」继续支付', icon: 'none' })
      return
    }
    this.setData({ paying: true })
    try {
      const data = await request({
        url: '/api/payment/create',
        method: 'POST',
        data: { orderNo: this.data.orderNo, channel: 'wxpay', scene: 'mini', device: 'wechat' },
      })
      if (data.payType === 'jsapi' && data.jsapiParams) {
        const p = data.jsapiParams
        await new Promise((resolve, reject) => {
          wx.requestPayment({
            timeStamp: p.timeStamp,
            nonceStr: p.nonceStr,
            package: p.package,
            signType: p.signType || 'RSA',
            paySign: p.paySign,
            success: resolve,
            fail: reject,
          })
        })
        wx.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => wx.redirectTo({ url: '/pages/orders/orders' }), 1200)
      } else {
        wx.showToast({ title: '暂不支持当前支付方式', icon: 'none' })
      }
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付，可稍后到「我的订单」继续', icon: 'none' })
      } else {
        wx.showToast({ title: e.message || '支付失败', icon: 'none' })
      }
    } finally {
      this.setData({ paying: false })
    }
  },

  /** 合同 PDF 地址：一律走接口（后端 /uploads 静态路径未对外 serve，会 404） */
  pdfUrl() {
    if (this.data.contractId) return '/api/miniapp/contracts/' + this.data.contractId + '/pdf'
    return ''
  },

  /**
   * 下载并打开合同 PDF
   * mode='view' 直接打开预览；mode='save' 打开后提示可「转发/保存」
   * 小程序无法直接写进手机文件夹，标准做法是 openDocument + showMenu，
   * 用户点右上角「···」即可保存到手机 / 转发到微信聊天。
   */
  async openPdf(e) {
    const mode = (e && e.currentTarget && e.currentTarget.dataset.mode) || 'view'
    const url = this.pdfUrl()
    if (!url) {
      wx.showToast({ title: 'PDF 未生成，请稍后再试', icon: 'none' })
      return
    }
    if (this.data.pdfBusy) return
    this.setData({ pdfBusy: true, pdfReady: false })
    wx.showLoading({ title: '下载中', mask: true })
    try {
      const name = (this.data.contract && (this.data.contract.contractNo || this.data.contract.orderNo)) || 'contract'
      // 带 .pdf 后缀落盘：临时文件没有扩展名，部分机型 openDocument 打不开
      const filePath = await download(url, { saveAs: name + '.pdf' })
      wx.hideLoading()
      await openFile(filePath, 'pdf')
      this.setData({ pdfReady: true })
      if (mode === 'save') {
        wx.showToast({ title: '已下载，点右上角···可保存/转发', icon: 'none', duration: 2600 })
      }
    } catch (err) {
      wx.hideLoading()
      if (err && err.code === 'UNAUTHORIZED') {
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 1200)
      } else {
        wx.showToast({ title: (err && err.message) || '下载失败', icon: 'none' })
      }
    } finally {
      this.setData({ pdfBusy: false })
    }
  },

  goSignMode() {
    wx.redirectTo({
      url:
        '/pages/contract/sign?mode=sign&orderNo=' +
        this.data.orderNo +
        '&contractId=' +
        this.data.contractId,
    })
  },

  noop() {},
})
