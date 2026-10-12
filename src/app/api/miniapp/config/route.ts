import { handle, ok } from '@/lib/api'
import { getWechatPublicConfig } from '@/lib/wechat-settings'

/**
 * 小程序端读取公开配置（不含任何密钥）
 * 后台关闭「启用小程序」时返回 enabled: false
 */
export async function GET() {
  return handle(async () => {
    const config = await getWechatPublicConfig()
    if (config.wxapp_enable !== '1') {
      return ok({ enabled: false, config: null })
    }
    return ok({ enabled: true, config })
  })
}
