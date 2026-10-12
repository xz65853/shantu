import { getSetting } from '@/lib/settings'
import { yuan } from '@/lib/contract-service'

/** 支付成功通知参数 */
export type OrderPaidPayload = {
  orderId: number
  orderNo: string
  memberId: number | null
  memberName: string
  phone: string
  packageName: string | null
  amount: number
  projectName: string
}

/** 手机号脱敏 */
function maskPhone(phone: string) {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

/**
 * 支付成功后通知：
 * 1. 企业微信群机器人 webhook（管理员）：新订单已创建，待分配负责人
 * 2. 小程序订阅消息（客户）：支付成功，顾问将在 24 小时内联系您
 */
export async function sendOrderPaidNotify(params: OrderPaidPayload) {
  // 1. 管理员通知
  try {
    const webhook = await getSetting('notify_webhook')
    if (webhook) {
      const content = [
        '💰 新订单已支付',
        `订单号：${params.orderNo}`,
        `客户：${params.memberName}（${maskPhone(params.phone)}）`,
        `套餐：${params.packageName || '未指定'}`,
        `金额：¥${yuan(params.amount)}`,
        `自动创建项目：${params.projectName}`,
        '请及时分配运营负责人 →',
      ].join('\n')
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgtype: 'text', text: { content } }),
        signal: AbortSignal.timeout(5000),
      })
      console.log('[notify] order paid sent', params.orderNo)
    }
  } catch (err) {
    console.warn('[notify] order paid failed', err instanceof Error ? err.message : '')
  }

  // 2. 小程序订阅消息（可选：通过模板消息发送）
  // 此处仅记录日志，实际订阅消息由业务层调用小程序 API 发送
  console.log('[notify] miniapp msg: 支付成功，顾问将在 24 小时内联系您', params.orderNo)
}