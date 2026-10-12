// utils/request.js 统一请求封装
// 后端统一响应契约：{ code: 0, message, data }（code=0 成功；401 未登录）
const BASE_URL = 'https://chenyi.ak03.cn'

function request(options) {
  const { url, method = 'GET', data = {}, noAuth = false } = options
  const token = wx.getStorageSync('token') || ''

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token && !noAuth ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        const body = res.data
        // 兼容 code===0（当前后端契约）与 success===true（旧契约）
        if (body && (body.code === 0 || body.success)) {
          // 后端 data 为 null 时兜底成 {}，避免页面 data.list 直接抛 TypeError 白屏
          const payload = body.data === undefined || body.data === null ? {} : body.data
          resolve(payload)
        } else if (res.statusCode === 401 || body?.code === 401 || body?.code === 'UNAUTHORIZED') {
          // 未登录：清 token（storage + globalData），触发重新登录
          clearAuth()
          reject({ code: 'UNAUTHORIZED', message: (body && body.message) || '请先登录' })
        } else {
          reject({ code: body?.code, message: (body && body.message) || '请求失败' })
        }
      },
      fail(err) {
        reject({ code: 'NETWORK', message: '网络异常，请稍后重试', err })
      },
    })
  })
}

/** 清除登录态：storage 与 globalData 一起清，避免拿到已失效 token 继续发请求 */
function clearAuth() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('member')
  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.token = ''
      app.globalData.member = null
    }
  } catch (e) {
    /* getApp 不可用时忽略 */
  }
}

/** 相对路径 → 绝对地址（后端若已返回完整 http(s) 地址则原样使用） */
function absUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.indexOf('//') === 0) return 'https:' + url
  return BASE_URL + (url.charAt(0) === '/' ? url : '/' + url)
}

/** 文件名去非法字符，避免落盘失败 */
function safeFileName(name) {
  return String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_')
}

/**
 * 下载文件（带登录态）
 * @param {string} url 相对或绝对地址
 * @param {object} [options]
 * @param {string} [options.saveAs] 落盘文件名（会自动补到 wx.env.USER_DATA_PATH 下）
 * @returns {Promise<string>} 本地文件路径
 */
function download(url, options = {}) {
  const token = wx.getStorageSync('token') || ''
  const target = absUrl(url)

  return new Promise((resolve, reject) => {
    if (!target) return reject({ message: '下载地址为空' })

    wx.downloadFile({
      url: target,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        if (res.statusCode === 200 && (res.tempFilePath || res.filePath)) {
          const temp = res.filePath || res.tempFilePath
          if (!options.saveAs) return resolve(temp)
          // 转存到用户目录并带上正确扩展名（临时文件名没有 .pdf 后缀，部分机型 openDocument 会失败）
          persist(temp, safeFileName(options.saveAs)).then(resolve, () => resolve(temp))
        } else if (res.statusCode === 401) {
          clearAuth()
          reject({ code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' })
        } else {
          reject({ message: '下载失败(' + res.statusCode + ')' })
        }
      },
      fail(err) {
        reject({ message: '网络异常，下载失败', err })
      },
    })
  })
}

/** 把临时文件转存到 USER_DATA_PATH，返回持久化路径 */
function persist(tempFilePath, fileName) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    const dir = wx.env.USER_DATA_PATH
    const filePath = dir + '/' + fileName
    // 同名文件已存在时先删，否则部分机型 saveFile 会失败
    try {
      fs.unlink({ filePath, fail: () => {} })
    } catch (e) {
      /* 不存在则忽略 */
    }
    fs.saveFile({
      tempFilePath,
      filePath,
      success: () => resolve(filePath),
      fail: reject,
    })
  })
}

/**
 * 打开本地文件（PDF/Word 等），showMenu=true 才会出现「转发/保存」入口
 * @returns {Promise<void>}
 */
function openFile(filePath, fileType = 'pdf') {
  return new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      fileType,
      showMenu: true, // 关键：没有它右上角不会出现「用其他应用打开/转发」
      success: () => resolve(),
      fail: (err) => reject({ message: '打开文件失败', err }),
    })
  })
}

module.exports = { request, download, openFile, absUrl, clearAuth, BASE_URL }
