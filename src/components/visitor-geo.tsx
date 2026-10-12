'use client'

import { useEffect } from 'react'

/**
 * 访客归属地探测（JSONP）
 *
 * 通过 ping0.cc 的 JSONP 接口拿到「访客自己」的外网 IP 与归属地，
 * 回填到后台访问流水中，弥补离线 IP 库对移动骨干网段（CGNAT）查不到省市的问题。
 *
 * 工程约束（重要）：
 *  1. 全程异步、非阻塞：等页面 load 之后再注入脚本，失败/超时一律静默，不影响首屏
 *  2. 每次会话只上报一次（sessionStorage 去重），避免重复请求拖慢页面
 *  3. 超时保护：12 秒拿不到结果就放弃，回退到服务端离线库结果
 */
export function VisitorGeo() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('visitor_geo_done')) return
    } catch {
      /* 隐私模式下 sessionStorage 不可用，继续探测一次 */
    }

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      try {
        sessionStorage.setItem('visitor_geo_done', '1')
      } catch {
        /* ignore */
      }
    }

    // JSONP 回调名随机，避免多标签页互相覆盖
    const cbName = '__geoCb_' + Math.random().toString(36).slice(2, 10)

    const timer = setTimeout(() => {
      finish()
      delete (window as unknown as Record<string, unknown>)[cbName]
      const s = document.getElementById(cbName + '_script')
      if (s) s.remove()
    }, 12000)

    ;(window as unknown as Record<string, unknown>)[cbName] = (
      ip?: string,
      location?: string,
      _asn?: string,
      _org?: string
    ) => {
      clearTimeout(timer)
      finish()
      if (!ip || !location) return
      // 上报失败不影响页面
      fetch('/api/visit/geo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, location, asn: _asn, org: _org }),
        keepalive: true,
      }).catch(() => {})
    }

    const script = document.createElement('script')
    script.id = cbName + '_script'
    script.src = `https://ping0.cc/geo/jsonp/${cbName}`
    script.async = true
    script.onerror = () => {
      clearTimeout(timer)
      finish()
    }
    document.head.appendChild(script)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  return null
}
