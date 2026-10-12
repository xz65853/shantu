import { prisma } from '@/lib/db'
import { getPaymentSettings } from '@/lib/payment-settings'
import { getWxpayConfig } from '@/lib/wxpay'
import {
  type CreatePaymentInput,
  type CreatePaymentResult,
  type NotifyVerifyResult,
  type PayChannel,
  type PaymentProvider,
  type PaymentProviderName,
  type RefundInput,
  type RefundResult,
} from './types'
import { MockPaymentProvider } from './providers/MockPaymentProvider'
import { YipayProvider } from './providers/YipayProvider'
import { WechatPayProvider } from './providers/WechatPayProvider'
import { handleOrderPaid } from '@/lib/order/OrderPostPaidService'

const REGISTRY: Record<PaymentProviderName, PaymentProvider> = {
  MOCK: new MockPaymentProvider(),
  YIPAY: new YipayProvider(),
  WECHAT: new WechatPayProvider(),
}

export function resolveProviderName(): PaymentProviderName {
  const raw = (process.env.PAYMENT_PROVIDER || 'MOCK').toUpperCase()
  return raw in REGISTRY ? (raw as PaymentProviderName) : 'MOCK'
}

export function getProvider(name?: PaymentProviderName): PaymentProvider {
  return REGISTRY[name || resolveProviderName()]
}

/** 渠道是否配置完整、可发起真实支付 */
export async function isProviderReady(name: PaymentProviderName): Promise<boolean> {
  if (name === 'MOCK') return true
  if (name === 'WECHAT') return Boolean(await getWxpayConfig())
  if (name === 'YIPAY') {
    const pay = await getPaymentSettings()
    return (
      pay.pay_epay_enable === '1' &&
      Boolean(pay.pay_epay_url && pay.pay_epay_pid && pay.pay_epay_private_key)
    )
  }
  return false
}

/** 智能路由：按用户选择的支付方式，选出可用的 Provider（微信为主，易支付备选） */
export async function pickProvider(channel: PayChannel): Promise<PaymentProviderName | null> {
  const preferred = resolveProviderName()
  const [wechat, yipay] = await Promise.all([isProviderReady('WECHAT'), isProviderReady('YIPAY')])

  if (channel === 'wxpay') {
    if (preferred === 'WECHAT' && wechat) return 'WECHAT'
    if (preferred === 'YIPAY' && yipay) return 'YIPAY'
    if (wechat) return 'WECHAT'
    if (yipay) return 'YIPAY'
    if (preferred === 'MOCK') return 'MOCK'
    return null
  }
  if (channel === 'alipay') {
    if (yipay) return 'YIPAY' // 官方支付宝未接入，易支付备选
    if (preferred === 'MOCK') return 'MOCK'
    return null
  }
  if (channel === 'qqpay') {
    if (yipay) return 'YIPAY'
    return null
  }
  return null
}

/** 记一笔支付日志（不含任何密钥） */
export async function logPayment(orderNo: string, provider: string, opts: { requestId?: string; status?: string; error?: string }) {
  try {
    await prisma.paymentLog.create({
      data: {
        orderNo,
        provider,
        requestId: opts.requestId || null,
        status: opts.status || 'INFO',
        error: opts.error || null,
      },
    })
  } catch {
    /* 日志失败不影响主流程 */
  }
}

/** 发起支付：调用 Provider 并落 Payment 流水 */
export async function createPayment(
  providerName: PaymentProviderName,
  orderId: number,
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const provider = getProvider(providerName)
  const result = await provider.createPayment(input)

  await prisma.payment.create({
    data: {
      orderId,
      provider: provider.name,
      tradeNo: result.tradeNo || null,
      amount: input.amount,
      status: 'PENDING',
    },
  }).catch(() => undefined)

  // 更新订单：记录选用的支付方式与 provider
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentProvider: provider.name,
      payMethod: channelToPayMethod(input.channel),
      payChannel: input.channel,
    },
  }).catch(() => undefined)

  return result
}

function channelToPayMethod(channel: string): 'WECHAT' | 'ALIPAY' | 'EPAY' | 'OFFLINE' {
  if (channel === 'alipay') return 'ALIPAY'
  if (channel === 'wxpay') return 'WECHAT'
  return 'EPAY'
}

export type NotifyOutcome = {
  ok: boolean
  duplicated?: boolean
  reason?: string
  orderId?: number
}

/**
 * 已验签/解密的支付确认：幂等事务改单 + 写流水。
 * 供统一回调 handleNotify 与微信（JSON 回调单独解密后）复用。
 */
export async function confirmPaid(
  provider: PaymentProvider,
  verified: NotifyVerifyResult,
): Promise<NotifyOutcome> {
  const order = await prisma.order.findUnique({ where: { orderNo: verified.orderNo } })
  if (!order) {
    await logPayment(verified.orderNo, provider.name, { status: 'ERROR', error: '订单不存在' })
    return { ok: false, reason: 'order_not_found' }
  }

  if (verified.amount !== order.amount) {
    await logPayment(verified.orderNo, provider.name, { status: 'ERROR', error: `金额不一致: 回调${verified.amount} vs 订单${order.amount}` })
    return { ok: false, reason: 'amount_mismatch' }
  }

  if (order.status === 'PAID') return { ok: true, duplicated: true, orderId: order.id }
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return { ok: false, reason: 'invalid_status' }
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id } })
    if (!current) return { ok: false as const, reason: 'order_not_found' }
    if (current.status === 'PAID') return { ok: true as const, duplicated: true as const }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        transactionId: verified.transactionId || null,
        paymentProvider: provider.name,
        payMethod: channelToPayMethod(verified.channel),
        payChannel: verified.channel || null,
      },
    })

    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: provider.name,
        tradeNo: verified.tradeNo || null,
        transactionId: verified.transactionId || null,
        amount: verified.amount,
        status: 'SUCCESS',
      },
    })

    return { ok: true as const, orderId: order.id }
  })

  await logPayment(verified.orderNo, provider.name, { status: 'SUCCESS', requestId: verified.tradeNo })

  // 支付成功后自动处理：创建合同 + 创建项目 + 通知（仅首次支付成功时执行）
  if (txResult.ok && !txResult.duplicated) {
    try {
      await handleOrderPaid(order.id)
    } catch (e) {
      console.error('[PaymentService] handleOrderPaid failed', e instanceof Error ? e.stack : String(e))
    }
  }

  return txResult
}

/**
 * 支付回调统一处理（幂等）：
 * 验签 → confirmPaid（查单、校验金额、判状态、事务内改单 + 写流水）。
 */
export async function handleNotify(
  providerName: PaymentProviderName,
  params: Record<string, string>,
): Promise<NotifyOutcome> {
  const provider = getProvider(providerName)
  let verified: NotifyVerifyResult | null
  try {
    verified = await provider.verifyNotify(params)
  } catch (e) {
    await logPayment('', provider.name, { status: 'ERROR', error: String(e) })
    return { ok: false, reason: 'verify_error' }
  }

  if (!verified) {
    await logPayment('', provider.name, { status: 'ERROR', error: '验签失败' })
    return { ok: false, reason: 'invalid_sign' }
  }
  if (!verified.paid) {
    return { ok: false, reason: 'not_paid' }
  }

  return confirmPaid(provider, verified)
}

export async function queryPayment(providerName: PaymentProviderName, orderNo: string) {
  const provider = getProvider(providerName)
  return provider.queryPayment(orderNo)
}

export async function refundPayment(providerName: PaymentProviderName, orderId: number, input: RefundInput): Promise<RefundResult> {
  const provider = getProvider(providerName)
  const result = await provider.refundPayment(input)
  await prisma.refund.create({
    data: {
      orderId,
      provider: provider.name,
      refundNo: result.refundNo || null,
      outRefundNo: input.refundNo,
      amount: input.amount,
      status: result.success ? 'SUCCESS' : 'FAILED',
      rawResponse: result.raw ? JSON.stringify(result.raw) : null,
    },
  }).catch(() => undefined)
  return result
}

export { REGISTRY }