import { NextRequest } from 'next/server'
import { fail, guard, handle, ok } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { decryptSecret } from '@/lib/wechat-settings'
import { aliyunMarketIdCardVerify, tencentMarketIdCardVerify } from '@/lib/realname'

export const dynamic = 'force-dynamic'

/** 测试实名认证渠道连通性（使用测试姓名+身份证；仅超管） */
export async function POST(req: NextRequest) {
  const { error } = await guard('settings')
  if (error) return error
  return handle(async () => {
    const settings = await getSettings()
    const channel = settings.realname_channel || 'none'

    if (channel === 'none') {
      return fail('未配置实名认证渠道', 400)
    }

    if (channel === 'wechat_face') {
      // 微信原生人脸核身需要前端环境，仅检查配置存在
      if (!settings.realname_wechat_verify_id) {
        return fail('微信原生人脸核身流水号未配置', 400)
      }
      return ok({ ok: true, message: '微信原生人脸核身配置已存在' })
    }

    if (channel === 'tencent' || channel === 'tencent_huyan') {
      const secretId = settings.realname_tencent_secret_id
        ? decryptSecret(settings.realname_tencent_secret_id)
        : ''
      const secretKey = settings.realname_tencent_secret_key
        ? decryptSecret(settings.realname_tencent_secret_key)
        : ''
      if (!secretId || !secretKey) {
        return fail('腾讯云市场密钥未配置，请先填写 SecretId/SecretKey 并保存', 400)
      }
      const endpoint = settings.realname_tencent_endpoint?.trim() || undefined
      // 用测试样本真实调一次市场 API：任何合法应答（含"不一致"）都证明链路连通
      try {
        const r = await tencentMarketIdCardVerify('张三', '110101199003077758', secretId, secretKey, endpoint)
        return ok({
          ok: true,
          message: r.ok
            ? '腾讯云市场二要素通道连通，测试样本核验一致'
            : `腾讯云市场二要素通道连通（测试样本返回：${r.message}）`,
        })
      } catch (e) {
        return fail((e as Error).message || '腾讯云市场二要素通道连接失败', 400)
      }
    }

    if (channel === 'aliyun') {
      const encAppCode = settings.realname_aliyun_appcode
      const appCode = encAppCode ? decryptSecret(encAppCode) : ''
      if (!appCode) {
        return fail('阿里云 AppCode 未配置，请先填写并保存', 400)
      }
      // 用测试样本真实调一次市场 API：任何合法应答（含"不一致"）都证明链路连通
      try {
        const r = await aliyunMarketIdCardVerify('张三', '110101199003077758', appCode)
        return ok({
          ok: true,
          message: r.ok
            ? '阿里云二要素通道连通，测试样本核验一致'
            : `阿里云二要素通道连通（测试样本返回：${r.message}）`,
        })
      } catch (e) {
        return fail((e as Error).message || '阿里云二要素通道连接失败', 400)
      }
    }

    return fail('未知认证渠道', 400)
  })
}
