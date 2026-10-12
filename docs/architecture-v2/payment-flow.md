# 支付流程设计

## 一、支付架构（现状已具备，2.0 强化）

可插拔 Provider：`PaymentProvider` 接口（createPayment/queryPayment/refundPayment/verifyNotify）。

| Provider | 用途 |
| --- | --- |
| WechatPayProvider | 微信支付 v3 官方（Native 扫码 / H5 跳转 / JSAPI 小程序） |
| YipayProvider | 易支付（第三方聚合，支付宝等备选通道） |
| MockPaymentProvider | 联调（生产 fail-closed） |

## 二、下单流程（后端权威计价）

```
前端提交 packageId + couponCode
   ↓
后端查套餐价格（pkg.price）
   ↓
服务端校验优惠码 → 计算抵扣
   ↓
finalAmount = price - discount（后端计算）
   ↓
创建订单 PENDING（快照套餐名/金额/服务项）
   ↓
返回 orderNo + amount
```

**红线**：前端**不传金额**，金额一律后端计算。

## 三、发起支付流程

```
前端提交 orderNo + channel + scene + device
   ↓
后端查订单（校验归属 memberId、状态）
   ↓
合同前置校验（套餐单必须 SIGNED）
   ↓
智能路由选 Provider（微信为主，易支付备选）
   ↓
Provider.createPayment → 返回二维码/跳转URL/JSAPI参数
   ↓
落 Payment 流水(PENDING)
```

## 四、支付回调流程（幂等）

```
微信回调（JSON body）
   ↓
平台证书验签（verifyWxpayNotifySignature）
   ↓
AES-256-GCM 解密 resource
   ↓
trade_state == SUCCESS ?
   ↓
confirmPaid（事务内）：
   1. 查订单（不存在 → 拒绝）
   2. 金额校验（不一致 → 拒绝 AMOUNT_MISMATCH）
   3. 状态校验（PAID → duplicated；CANCELLED/REFUNDED → 拒绝）
   4. 事务改单：status=PAID + paidAt + transactionId
   5. 写 Payment 流水(SUCCESS)
   ↓
返回 { code: SUCCESS }
```

## 五、幂等与防重复

| 场景 | 处理 |
| --- | --- |
| 重复回调 | `order.status === PAID` → 返回 duplicated |
| 重复下单 | 用户可多单，但每单独立 orderNo；前端防重复点击 |
| 金额篡改 | 回调金额 ≠ 订单金额 → 拒绝 |
| 回调丢失 | 定时/主动 `queryPayment` 兜底查单 |
| 支付超时 | PENDING/PAYING 超 2h → EXPIRED |

## 六、退款流程

```
后台（超管/财务）发起退款
   ↓
校验订单状态（PAID/COMPLETED）
   ↓
Provider.refundPayment（outRefundNo 幂等键）
   ↓
写 Refund 流水
   ↓
订单 REFUNDING → REFUNDED
   ↓
项目联动（未开始项目 → CANCELLED）
```

## 七、安全红线（现状已实现，2.0 保持）

1. 前端**不决定**最终订单金额。
2. 前端**不决定**支付成功（只有后端验签 + 回调才改单）。
3. Mock 支付生产环境 **fail-closed**（生产禁用 + 需显式开关）。
4. 支付前合同已签署（后端硬校验）。
5. 订单归属校验（不能支付他人订单）。

## 八、生产配置注意

- `.env` 生产必须 `PAYMENT_PROVIDER=WECHAT`（或 YIPAY），**禁止 MOCK**。
- 商户私钥/APIv3 密钥 AES-256-GCM 加密落库（后台维护）。
- 回调域名 `https://chenyi.ak03.cn/api/payment/wxpay/notify` 需在微信商户平台配置。

## 九、建议增强（2.0）

1. 支付超时定时任务（PENDING → EXPIRED）。
2. 退款自动对账（主动查询退款结果）。
3. 支付流水告警（验签失败/金额不一致触发告警）。
4. 对账单导出（财务对账）。
