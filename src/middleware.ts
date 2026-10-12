import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from './lib/session'

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 维护页（503）：居中显示图标、标题、原因、预计恢复时间与小程序码 */
function maintenanceHtml(reason: string, resumeAt: string, qrcodeUrl: string): string {
  const reasonSafe = escapeHtml(reason || '网站升级维护中，预计 24 小时内恢复')
  const resume = resumeAt ? `<div style="margin-top:8px;color:#b0b7c3;font-size:13px;">预计恢复时间：${escapeHtml(resumeAt)}</div>` : ''
  const qr = qrcodeUrl
    ? `<img src="${escapeHtml(qrcodeUrl)}" alt="小程序码" style="width:120px;height:120px;object-fit:contain;border-radius:10px;background:#fff;padding:6px;box-shadow:0 2px 10px rgba(0,0,0,.08);" />`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>网站维护中</title>
<meta name="robots" content="noindex" />
</head>
<body style="margin:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="max-width:420px;width:100%;text-align:center;">
    <div style="font-size:56px;line-height:1;">&#128295;</div>
    <h1 style="margin:20px 0 12px;font-size:24px;color:#1e2a3b;">网站维护中</h1>
    <p style="margin:0;color:#5b6b82;font-size:15px;line-height:1.7;white-space:pre-line;">${reasonSafe}</p>
    ${resume}
    <div style="margin-top:36px;padding-top:24px;border-top:1px solid #e8ecf2;">
      <div style="color:#5b6b82;font-size:13px;margin-bottom:12px;">小程序正常使用，扫码进入</div>
      ${qr}
    </div>
  </div>
</div>
</body>
</html>`
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 统一给下游加 x-pathname，供 recordVisit 等服务端组件取真实路径
  const withPathname = (next) => {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', pathname)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // 静态文件（带扩展名，如 /robots.txt、/sitemap.xml、图片等）不拦截
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return withPathname()
  // /uploads 物理文件不受维护影响
  if (pathname.startsWith('/uploads')) return withPathname()

  const isLogin = pathname === '/admin/login'
  const isMEntry = pathname === '/admin/m'
  if (isMEntry) return withPathname()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null

  // /admin 登录鉴权（保持不变）
  if (pathname.startsWith('/admin')) {
    if (!session && !isLogin) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    if (session && isLogin) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin'
      url.searchParams.delete('from')
      return NextResponse.redirect(url)
    }
    return withPathname()
  }

  // 前台页面：管理员（带有效 session）放行预览
  if (session) return withPathname()

  // 维护模式判断：查维护状态（/api 已被 matcher 排除，不会循环）
  try {
    // 【修复】自调用必须走本地回环 HTTP，不能用 req.nextUrl.origin：
    // 线上 HTTPS 请求时 origin=https://chenyi.ak03.cn，middleware runtime 下该自调用会静默失败被 catch 吞掉，
    // 导致维护判断形同虚设（前台 200）。直接打本地 3008 绕过 nginx/HTTPS。
    const selfOrigin = process.env.SELF_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3008}`
    const res = await fetch(`${selfOrigin}/api/maintenance-status`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      const d = json?.data
      if (d?.enabled === true) {
        const qrcode = d.qrcode ? (String(d.qrcode).startsWith('http') ? d.qrcode : req.nextUrl.origin + d.qrcode) : ''
        return new NextResponse(maintenanceHtml(d.reason, d.resumeAt, qrcode), {
          status: 503,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        })
      }
    }
  } catch {
    // 查询失败则放行，避免误伤正常访问
  }

  return withPathname()
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
}
