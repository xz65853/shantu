/**
 * IP → 归属地（省/市/运营商），基于 ip2region 离线库。
 *
 * 设计约束：
 *   - 离线查询，不出网、不依赖第三方接口（管理后台低频展示，内存查询足够快）
 *   - searcher 进程内单例；db 文件缺失 / 库异常时静默降级为空串，
 *     展示层退化为只显示 IP，绝不能让归属地问题弄挂页面
 */

type RegionResult = { country?: string; province?: string; city?: string; isp?: string }

let searcher: { search(ip: string): RegionResult } | null = null
let failed = false

function getSearcher() {
  if (searcher || failed) return searcher
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('ip2region')
    const IP2Region = mod.default || mod
    // db 用绝对路径：standalone 构建的产物目录结构不稳定，不依赖 cwd
    const candidates = [
      '/www/wwwroot/shantu-web/data/ip2region.db',
      require('path').join(process.cwd(), 'data/ip2region.db'),
      require('path').join(process.cwd(), 'node_modules/ip2region/data/ip2region.db'),
    ]
    const fs = require('fs') as typeof import('fs')
    const db = candidates.find((p) => fs.existsSync(p))
    // 数据库加载到内存约 9MB，常驻可接受；ipv6 查询用不到，关掉省内存
    searcher = new IP2Region(
      db ? { ipv4db: db, disableIpv6: true } : { disableIpv6: true },
    )
  } catch {
    failed = true
  }
  return searcher
}

function tidy(s?: string | null): string {
  return (s || '').trim()
}

function fmtRegion(r: RegionResult): string {
  const country = tidy(r.country)
  if (tidy(r.city) === '内网IP' || tidy(r.isp) === '内网IP') return '内网'

  if (country && country !== '中国') {
    // 海外：国家 + 省/市里较长的一个
    const sub = tidy(r.province) || tidy(r.city)
    return sub && sub !== country ? `${country}${sub}` : country
  }

  // 中国：省 + 市（直辖市去重，如 上海/上海市 → 上海）
  const prov = tidy(r.province).replace(/(壮族|回族|维吾尔)?自治区$/, '').replace(/省$/, '')
  const city = tidy(r.city).replace(/市$/, '')
  if (prov && city && prov !== city) return `${prov}${city}`
  if (prov) return prov
  if (city) return city
  // 移动/联通骨干网段查不到省市，退到运营商
  const isp = tidy(r.isp).replace(/^中国/, '')
  return isp
}

/**
 * 客户端 JSONP 上报的归属地（ping0.cc 返回形如「中国 湖南省益阳市」）→ 短标签
 * 例：中国 湖南省益阳市 → 湖南益阳；中国 海南省海口市 → 海南海口
 */
export function tidyGeoClient(s?: string | null): string {
  let v = tidy(s)
  if (!v) return ''
  v = v.replace(/^中国\s*/, '')
  v = v.replace(/(壮族|回族|维吾尔)?自治区/g, '')
  v = v.replace(/特别行政区/g, '')
  v = v.replace(/省/g, '').replace(/市/g, '')
  return v.replace(/\s+/g, '')
}

/**
 * 展示用归属地：优先用客户端上报的真实归属地（对移动 CGNAT 网段更准），
 * 拿不到再退到离线库结果。
 */
export function regionLabel(ip?: string | null, geoClient?: string | null): string {
  const g = tidyGeoClient(geoClient)
  if (g) return g
  return ipRegion(ip)
}

/** 归属地短标签，如「湖南益阳」「中国移动」「美国纽约」「内网」；查不到返回空串 */
export function ipRegion(ip?: string | null): string {
  if (!ip) return ''
  const s = getSearcher()
  if (!s) return ''
  let r: RegionResult | null = null
  try {
    r = s.search(ip)
  } catch {
    return ''
  }
  if (!r) return ''
  try {
    return fmtRegion(r)
  } catch {
    return ''
  }
}
