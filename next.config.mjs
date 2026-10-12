/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 独立输出：服务器无需 node_modules，直接 node server.js 启动
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // 自定义输出目录（避开 .next 目录权限问题）
  distDir: 'dist',
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async headers() {
    // 全站安全响应头：防点击劫持 / MIME 嗅探 / 强制 HTTPS / 收紧 Referrer 与浏览器权限
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // 宽松 CSP：允许内联（Next.js 自托管需要）、https 源、微信JSSDK；不允许第三方脚本
      { key: 'Content-Security-Policy', value: "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.weixin.qq.com https://*.qq.com; style-src 'self' 'unsafe-inline' https://*.weixin.qq.com; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https: blob:; media-src 'self' https: blob:; frame-src 'self' https://*.weixin.qq.com; object-src 'none'; base-uri 'self'" },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
}

export default nextConfig
