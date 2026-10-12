import { NextRequest, NextResponse } from 'next/server'
import { decryptNotifyResource, getWxpayConfig, verifyWxpayNotifySignature } from '@/lib/wxpay'
import { confirmPaid, getProvider, logPayment } from '@/lib/payment/PaymentService'

/**
 * 微信支付 v3 回调（POST，加密 JSON body）
 * 安全流程：平台证书验签 → 解密 resource → trade_state=SUCCESS →
 * confirmPaid（金额一致性校验 + 幂等事务改单 + 写支付流水）。
 * 微信要求返回 { code: 'SUCCESS' } / { code: 'FAIL' }。
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    let body: {
      resource?: { ciphertext: string; nonce: string; associated_data?: string }
    } = {}
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ code: 'FAIL', message: '参数错误' })
    }

    const cfg = await getWxpayConfig()
    if (!cfg || !body.resource) return NextResponse.json({ code: 'FAIL', message: '商户未配置' })

    // 1) 平台证书验签：防止伪造回调
    const signOk = await verifyWxpayNotifySignature(
      cfg,
      {
        timestamp: req.headers.get('wechatpay-timestamp') || '',
        nonce: req.headers.get('wechatpay-nonce') || '',
        signature: req.headers.get('wechatpay-signature') || '',
        serial: req.headers.get('wechatpay-serial') || '',
      },
      raw,
    )
    if (!signOk) {
      await logPayment('', 'WECHAT', { status: 'ERROR', error: '回调验签失败' })
      return NextResponse.json({ code: 'FAIL', message: '验签失败' })
    }

    // 2) 解密资源
    const data = decryptNotifyResource(cfg.apiV3Key, body.resource)
    if (!data.out_trade_no) return NextResponse.json({ code: 'FAIL', message: '订单号缺失' })

    const provider = getProvider('WECHAT')
    if (data.trade_state !== 'SUCCESS') {
      await logPayment(data.out_trade_no, 'WECHAT', { status: 'INFO', error: `非成功状态 ${data.trade_state}` })
      return NextResponse.json({ code: 'SUCCESS', message: '忽略未成功状态' })
    }

    // 3) 幂等确认（内部校验金额一致性 + 事务改单）
    const out = await confirmPaid(provider, {
      orderNo: data.out_trade_no,
      tradeNo: data.transaction_id || '',
      transactionId: data.transaction_id || '',
      amount: data.amount?.total ?? 0,
      channel: 'wxpay',
      paid: true,
    })

    return NextResponse.json({ code: out.ok ? 'SUCCESS' : 'FAIL', message: out.reason || '' })
  } catch (e) {
    console.error('[WXPAY NOTIFY]', e instanceof Error ? e.stack : String(e))
    return NextResponse.json({ code: 'FAIL', message: '处理失败' })
  }
}
