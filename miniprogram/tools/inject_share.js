// 批量给小程序每个页面注入 onShareAppMessage（首页额外 onShareTimeline）
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'pages')

// 每个页面的分享配置
// shareTitle: 分享给朋友的标题；timelineTitle: 首页朋友圈标题；path: 带参分享路径（null=不带参）
const config = {
  'index/index.js': {
    title: '闪途 · 短视频代运营，让好内容跑出好生意',
    timeline: true,
    timelineTitle: '闪途 · 短视频代运营，让好内容跑出好生意',
  },
  'lead/lead.js': { title: '免费预约 · 闪途短视频代运营' },
  'services/services.js': { title: '闪途服务 · 短视频代运营套餐' },
  'services/detail.js': { title: '闪途服务详情', path: (o) => (o.slug ? '?slug=' + o.slug : '') },
  'cases/cases.js': { title: '闪途案例 · 我们的代运营成果' },
  'cases/detail.js': { title: '闪途案例详情', path: (o) => (o.slug ? '?slug=' + o.slug : '') },
  'projects/projects.js': { title: '我的项目 · 闪途代运营' },
  'projects/detail.js': { title: '项目详情', path: (o) => (o.id ? '?id=' + o.id : '') },
  'orders/orders.js': { title: '我的订单' },
  'orders/pay.js': { title: '闪途订单支付' },
  'contract/contracts.js': { title: '我的合同' },
  'contract/sign.js': { title: '闪途合同签署' },
  'realname/realname.js': { title: '实名认证' },
  'mine/mine.js': { title: '闪途 · 短视频代运营' },
  'login/login.js': { title: '闪途 · 短视频代运营' },
}

function buildShareFn(relPage, cfg) {
  const pagePath = 'pages/' + relPage.replace('.js', '')
  // 是否带参
  const hasParam = typeof cfg.path === 'function'
  const lines = []
  lines.push('  onShareAppMessage() {')
  lines.push(`    const title = '${cfg.title}'`)
  if (hasParam) {
    lines.push('    const q = ' + cfg.path.toString().replace(/^\(o\) => /, 'function (o) { return ') + ' }')
    lines.push("    const query = q({ slug: this.slug, id: this.id }) || ''")
    lines.push(`    return { title, path: '/${pagePath}' + query }`)
  } else {
    lines.push(`    return { title, path: '/${pagePath}' }`)
  }
  lines.push('  },')
  if (cfg.timeline) {
    lines.push('  onShareTimeline() {')
    lines.push(`    return { title: '${cfg.timelineTitle}' }`)
    lines.push('  },')
  }
  return lines.join('\n')
}

function inject(filePath, relPage, cfg) {
  let src = fs.readFileSync(filePath, 'utf8')
  if (src.includes('onShareAppMessage')) {
    console.log('SKIP(已有) ' + relPage)
    return
  }
  const snippet = buildShareFn(relPage, cfg)
  // 插入到 Page({ 之后第一行
  const m = src.match(/Page\(\{/)
  if (!m) {
    console.log('NO-PAGE ' + relPage)
    return
  }
  const idx = src.indexOf('Page({') + 'Page({'.length
  const newSrc = src.slice(0, idx) + '\n' + snippet + src.slice(idx)
  fs.writeFileSync(filePath, newSrc, 'utf8')
  console.log('OK ' + relPage)
}

for (const [rel, cfg] of Object.entries(config)) {
  const fp = path.join(ROOT, rel)
  if (!fs.existsSync(fp)) {
    console.log('MISSING ' + rel)
    continue
  }
  inject(fp, rel, cfg)
}
console.log('done')
