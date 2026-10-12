import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 腾讯广告点击监测（Conversion Tracking）
 *
 * 腾讯广告后台「点击监测链接」填：
 *   https://chenyi.ak03.cn/api/ad/tencent/click?cid=__CLICK_ID__&ts=__CLICK_TIME__&account_id=__ACCOUNT_ID__&callback=__CALLBACK__
 *
 * 流程：用户点广告 → 腾讯跳到本接口 → 记录 clickid → 302 跳落地页（带 clickid）
 * 落地页/小程序把 clickid 存下来，留资下单时回传，腾讯后台即可算出 ROI。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const clickid = (sp.get('cid') || sp.get('clickid') || '').trim().slice(0, 100)
  const oaid = (sp.get('oaid') || '').trim().slice(0, 100)
  // 腾讯下发的回传 URL。注意：Next.js searchParams.get() 已自动 url-decode 一次，
  // 拿到的即是可直接 POST 的地址，回传时不要再 decode（官方警告二次 decode 会报错）
  const callback = (sp.get('callback') || '').trim().slice(0, 900)
  const ts = sp.get('ts') || ''
  const referer = req.headers.get('referer') || ''
  const userAgent = req.headers.get('user-agent') || ''
  const ip =
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    ''

  // 落地页：默认小程序 AppID 对应的 URL Scheme，可在后台改
  // 优先级：URL 里显式指定 next > 环境变量 TENCENT_ADS_LANDING_URL > 官网首页
  const fallbackLanding =
    process.env.TENCENT_ADS_LANDING_URL || 'https://chenyi.ak03.cn/?from=tencent'

  // 无效 clickid（未替换宏、格式异常）直接跳落地页，不写脏数据
  const valid = clickid.length >= 8 && /^[A-Za-z0-9_\-]+$/.test(clickid)

  if (valid) {
    try {
      await prisma.adClick.upsert({
        where: { clickid },
        // 重复点击只补 oaid，不重复计一次点击
        update: {
          oaid: oaid || undefined,
          ...(callback.startsWith('http') ? { callback } : {}),
        },
        create: {
          clickid,
          oaid: oaid || null,
          callback: callback.startsWith('http') ? callback : null,
          ip,
          userAgent,
          referer: referer || null,
          landingPage: fallbackLanding,
        },
      })
    } catch (e) {
      // 落库失败不能阻断跳转，否则用户点广告会看到白屏
      console.warn('[ad/click] 记录点击失败：', e instanceof Error ? e.message : e)
    }
  }

  // 拼上 clickid，供落地页/小程序读取
  const dest = new URL(fallbackLanding)
  dest.searchParams.set('from', 'tencent')
  if (valid) dest.searchParams.set('clickid', clickid)
  // 腾讯广告 ts 原样带过去，便于对账
  if (ts) dest.searchParams.set('ts', ts)

  return NextResponse.redirect(dest.toString(), 302)
}
