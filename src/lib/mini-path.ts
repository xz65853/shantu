/**
 * 页面路径 → 中文标签
 *
 * visit_logs.path 里存的是原始路径：
 *   小程序会话上报时统一写成 `MINI:pages/xxx/xxx`
 *   官网（Web）则是 `/`、`/blog` 这类路径
 * 管理后台展示时翻译成中文，运营同学不用猜页面编号。
 */

const MINI_PAGES: Record<string, string> = {
  'pages/index/index': '首页',
  'pages/lead/lead': '免费预约',
  'pages/services/services': '服务与套餐',
  'pages/services/detail': '服务详情',
  'pages/cases/cases': '案例列表',
  'pages/cases/detail': '案例详情',
  'pages/projects/projects': '我的项目',
  'pages/projects/detail': '项目详情',
  'pages/orders/orders': '我的订单',
  'pages/orders/detail': '订单详情',
  'pages/orders/pay': '订单支付',
  'pages/contract/contracts': '我的合同',
  'pages/contract/sign': '合同签署',
  'pages/realname/realname': '实名认证',
  'pages/agreement/agreement': '用户协议',
  'pages/mine/mine': '个人中心',
  'pages/login/login': '登录',
}

const WEB_PAGES: Record<string, string> = {
  '/': '官网首页',
  '/blog': '官网·博客',
  '/pricing': '官网·产品价格',
  '/services': '官网·服务',
  '/cases': '官网·案例',
  '/about': '官网·关于我们',
  '/contact': '官网·联系我们',
}

/** 去掉 query 与 hash 后的干净路径 */
function cleanPath(raw: string): string {
  return raw.split('?')[0].split('#')[0]
}

/**
 * 路径 → 中文标签。识别不了的原样返回（去掉 MINI: 前缀），
 * 保证新页面上线后不会显示成空白，只是中文映射晚一步补。
 */
export function pageLabel(rawPath?: string | null): string {
  if (!rawPath) return '—'
  const clean = cleanPath(rawPath)

  if (clean.startsWith('MINI:')) {
    const p = clean.slice(5)
    return MINI_PAGES[p] || p
  }
  if (clean.startsWith('pages/')) {
    // entry_page 字段存的是不带 MINI: 前缀的小程序页面路径
    return MINI_PAGES[clean] || clean
  }
  if (WEB_PAGES[clean]) return WEB_PAGES[clean]
  if (clean.startsWith('/services/')) return '官网·服务详情'
  if (clean.startsWith('/cases/')) return '官网·案例详情'
  if (clean.startsWith('/blog/')) return '官网·文章详情'
  return clean
}
