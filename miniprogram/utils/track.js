// utils/track.js
// 广告监测埋点：渠道标记（自然 / 广告）· 用户使用记录 · 会话上报
//
// 口径定义（对应工作台画布《闪途_广告监测工作台》画板 C）：
//   channel = 'ad'       当且仅当 clickid 非空
//   channel = 'organic'  其余所有情况（微信搜索 / 好友分享 / 扫码 / 历史留存）
//   is_new               由后端以 openid 首次出现为准；前端本地标记仅作参考
//
// 三条硬约束：
//   1. 埋点失败一律静默，绝不阻塞业务、绝不弹 toast
//   2. 上报统一 noAuth，避免 401 触发 clearAuth 把已登录用户踢下线
//   3. 后端按 visit_id 幂等 upsert（同一会话会多次上报，用于更新最终停留时长）

const { request } = require('./request')

/** 总开关：后端接口未就绪时可置 false 整体关闭，无需回滚页面改动 */
const TRACK_ENABLED = true

/** 切后台超过该时长再回来，视为新会话 */
const SESSION_GAP_MS = 30 * 60 * 1000
/** 停留满该时长做一次兜底上报（会话继续，onHide 时再 upsert 最终时长） */
const REPORT_AFTER_MS = 30 * 1000
/** 单会话路径最大节点数，防止异常循环把数组撑爆 */
const MAX_PATH = 20
/** 离线补发队列最大长度 */
const MAX_QUEUE = 50
/** wx.login code 复用窗口（官方有效期 5 分钟，留 1 分钟余量） */
const CODE_TTL_MS = 4 * 60 * 1000

const K_VISIT = 'track_visit'
const K_LAST_ACTIVE = 'track_last_active'
const K_QUEUE = 'track_queue'
const K_LOCAL_FIRST = 'track_local_first'
const K_SCENE = 'track_scene'

/** 路由 → 中文名，用于工作台「访问路径」列展示 */
const PAGE_LABELS = {
  'pages/index/index': '首页',
  'pages/lead/lead': '预约',
  'pages/services/services': '服务',
  'pages/services/detail': '服务详情',
  'pages/cases/cases': '案例',
  'pages/cases/detail': '案例详情',
  'pages/projects/projects': '项目',
  'pages/projects/detail': '项目详情',
  'pages/orders/orders': '订单',
  'pages/orders/detail': '订单详情',
  'pages/orders/pay': '支付',
  'pages/contract/contracts': '合同',
  'pages/contract/sign': '签署',
  'pages/realname/realname': '实名',
  'pages/agreement/agreement': '协议',
  'pages/mine/mine': '我的',
  'pages/login/login': '登录',
}

/** 小程序场景值 → 来源细分（归类到工作台「来源」列） */
const SCENE_SOURCE = {
  1001: '微信发现页',
  1005: '微信搜索',
  1006: '微信搜索',
  1053: '搜一搜',
  1054: '微信搜索',
  1007: '好友分享',
  1008: '好友分享',
  1011: '扫码直达',
  1012: '扫码直达',
  1013: '扫码直达',
  1031: '扫码直达',
  1032: '扫码直达',
  1047: '扫码直达',
  1048: '扫码直达',
  1049: '扫码直达',
  1035: '公众号菜单',
  1058: '公众号文章',
  1091: '公众号文章',
  1067: '公众号文章广告',
  1074: '公众号消息',
  1073: '客服消息',
  1026: '历史留存',
  1027: '历史留存',
  1028: '我的小程序',
  1069: '历史留存',
  1104: '历史留存',
  1045: '朋友圈广告',
  1046: '朋友圈广告',
  1084: '朋友圈广告',
  1065: 'URL Scheme',
  1120: '视频号',
  1121: '视频号主页',
  1124: '视频号直播',
  1119: '企业微信',
}

let session = null
let reportTimer = null
let wxCode = ''
let wxCodeAt = 0

/* ---------------- 底层安全读写：storage 异常绝不能把页面带崩 ---------------- */

function safeGet(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    return v === '' || v === undefined || v === null ? fallback : v
  } catch (e) {
    return fallback
  }
}

function safeSet(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (e) {
    /* 忽略 */
  }
}

function safeRemove(key) {
  try {
    wx.removeStorageSync(key)
  } catch (e) {
    /* 忽略 */
  }
}

function safeApp() {
  try {
    return getApp()
  } catch (e) {
    return null
  }
}

/* ---------------- 会话与标识 ---------------- */

function genVisitId() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const stamp = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
  return 'vs_' + stamp + '_' + Math.random().toString(36).slice(2, 8)
}

/**
 * 刷新 wx.login code。后端用它 code2session 换 openid，
 * 这样未登录访客也能进「今日访问流水」，而不只是已登录会员。
 */
function refreshCode() {
  if (wxCode && Date.now() - wxCodeAt < CODE_TTL_MS) return
  try {
    wx.login({
      success: (res) => {
        if (res && res.code) {
          wxCode = res.code
          wxCodeAt = Date.now()
        }
      },
      fail: () => {},
    })
  } catch (e) {
    /* 忽略 */
  }
}

/** 来源细分：广告看 clickid，自然看场景值 */
function resolveSource(scene, clickid) {
  const s = String(scene || '')
  if (clickid) {
    // 细分到广告计划需后端按 clickid 反查，前端只标到「腾讯广告」
    return '腾讯广告'
  }
  if (/^ad-/i.test(s)) return '腾讯广告'
  if (SCENE_SOURCE[s]) return SCENE_SOURCE[s]
  if (!s || s === '1001') return '微信发现页'
  return '其他'
}

/**
 * 开启 / 延续会话。App 的 onLaunch 与 onShow 都要调用。
 * @param {object} options App 生命周期入参（含 scene / query）
 */
function startSession(options) {
  if (!TRACK_ENABLED) return
  const opts = options || {}
  const scene = String(opts.scene || safeGet(K_SCENE, '') || '')
  if (scene) safeSet(K_SCENE, scene)

  refreshCode()

  const cached = safeGet(K_VISIT, null)
  const last = Number(safeGet(K_LAST_ACTIVE, 0) || 0)
  const gap = Date.now() - last

  // 有未结算会话且间隔在 30 分钟内 → 沿用（覆盖 onHide 未触发、进程被杀等异常）
  if (cached && cached.visit_id && cached.first_at && gap < SESSION_GAP_MS) {
    session = cached
    session.path = session.path || []
    touchActive()
    scheduleReport()
    return
  }

  // 旧缓存已过期：先把它补发出去，再开新会话
  if (cached && cached.visit_id) {
    report(cached, 'expired')
    safeRemove(K_VISIT)
  }

  const app = safeApp()
  const clickid = (app && app.globalData && app.globalData.clickid) || safeGet('clickid', '') || ''
  const localFirst = !safeGet(K_LOCAL_FIRST, '')
  if (localFirst) safeSet(K_LOCAL_FIRST, '1')

  session = {
    visit_id: genVisitId(),
    first_at: Date.now(),
    channel: clickid ? 'ad' : 'organic',
    clickid: clickid || '',
    source: resolveSource(scene, clickid),
    scene: scene,
    entry_page: '',
    path: [],
    is_lead: false,
    local_first: localFirst,
    reported: false,
  }
  safeSet(K_VISIT, session)
  touchActive()
  scheduleReport()
}

function touchActive() {
  safeSet(K_LAST_ACTIVE, Date.now())
}

function persist() {
  if (session) safeSet(K_VISIT, session)
}

function scheduleReport() {
  if (reportTimer) return
  reportTimer = setTimeout(() => {
    reportTimer = null
    report(session, 'timer')
  }, REPORT_AFTER_MS)
}

/* ---------------- 上报 ---------------- */

/**
 * 上报一次会话。后端按 visit_id 幂等 upsert，
 * 所以「30 秒兜底」和「onHide 最终结算」会各发一次，后者覆盖最终时长。
 * @param {object} target 会话对象（可能已被置空的旧会话）
 * @param {string} reason 上报原因，便于后端排查
 */
function report(target, reason) {
  if (!TRACK_ENABLED || !target || !target.visit_id) return

  const app = safeApp()
  const member =
    (app && app.globalData && app.globalData.member) || safeGet('member', null) || null

  const payload = {
    visit_id: target.visit_id,
    member_id: member && member.id ? String(member.id) : '',
    channel: target.channel || 'organic',
    clickid: target.clickid || '',
    source: target.source || '',
    scene: target.scene || '',
    entry_page: target.entry_page || '',
    path: (target.path || []).slice(0, MAX_PATH),
    duration: Math.max(0, Math.round((Date.now() - target.first_at) / 1000)),
    is_lead: !!target.is_lead,
    first_at: target.first_at,
    // 后端用 code 换 openid；已登录时优先用 member_id 关联
    code: wxCode || '',
    // 本地首访标记，仅参考：换设备 / 清缓存会失效，真实 is_new 以后端 openid 为准
    local_first: target.local_first ? 1 : 0,
    reason: reason || '',
  }

  target.reported = true
  send(payload)
}

function send(payload) {
  payload.attempts = (payload.attempts || 0) + 1
  request({ url: '/api/ad/visit', method: 'POST', data: payload, noAuth: true })
    .then(() => {})
    .catch(() => {
      // 失败入队，下次启动补发；最多重试 3 次，避免无效数据长期堆积
      if (payload.attempts < 3) enqueue(payload)
    })
}

function enqueue(payload) {
  const q = safeGet(K_QUEUE, [])
  if (!Array.isArray(q)) return
  q.push(payload)
  while (q.length > MAX_QUEUE) q.shift()
  safeSet(K_QUEUE, q)
}

/** 启动时补发离线队列（App.onLaunch 调用） */
function flushQueue() {
  const q = safeGet(K_QUEUE, [])
  if (!Array.isArray(q) || !q.length) return
  safeSet(K_QUEUE, [])
  q.forEach((p) => send(p))
}

/** 结束会话：结算最终时长并清缓存（App.onHide 调用） */
function endSession() {
  if (reportTimer) {
    clearTimeout(reportTimer)
    reportTimer = null
  }
  if (!TRACK_ENABLED) return
  if (!session) return
  report(session, 'hide')
  safeRemove(K_VISIT)
  session = null
  safeSet(K_LAST_ACTIVE, Date.now())
}

/** 当前会话 ID，供 /api/ad/bind 关联广告点击与会话 */
function getVisitId() {
  return (session && session.visit_id) || (safeGet(K_VISIT, null) || {}).visit_id || ''
}

/** 留资成功时调用：立即上报，避免用户提交后直接退出导致漏记 */
function markLead() {
  if (!session) return
  session.is_lead = true
  persist()
  report(session, 'lead')
}

/* ---------------- 页面追踪 ---------------- */

/** 记录一次页面进入：落地页 + 路径序列（连续相同节点去重） */
function trackPageEnter(page) {
  if (!TRACK_ENABLED) return
  const route = (page && page.route) || ''
  if (!route) return

  if (!session) startSession()
  if (!session) return

  if (!session.entry_page) session.entry_page = route
  const label = PAGE_LABELS[route] || route
  const path = session.path || []
  if (path[path.length - 1] !== label) path.push(label)
  session.path = path.slice(0, MAX_PATH)

  persist()
  touchActive()
}

/**
 * 页面包装器：把 Page({...}) 换成 trackPage({...}) 即可接入，
 * 自动注入进入追踪，业务原有的 onLoad / onShow / onHide 原样保留。
 */
function trackPage(options) {
  if (!options || typeof options !== 'object') return Page(options)

  const rawOnLoad = options.onLoad
  const rawOnShow = options.onShow
  const rawOnUnload = options.onUnload

  options.onLoad = function (query) {
    trackPageEnter(this)
    if (typeof rawOnLoad === 'function') return rawOnLoad.call(this, query)
  }
  options.onShow = function () {
    trackPageEnter(this)
    if (typeof rawOnShow === 'function') return rawOnShow.call(this)
  }
  // 页面卸载不结束会话（页面间跳转是常态），仅在 onHide 时刷新活跃时间
  options.onUnload = function () {
    touchActive()
    if (typeof rawOnUnload === 'function') return rawOnUnload.call(this)
  }

  return Page(options)
}

module.exports = {
  trackPage,
  startSession,
  endSession,
  markLead,
  flushQueue,
  getVisitId,
}
