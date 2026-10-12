# 订单状态机

## 一、状态定义

| 状态 | 含义 | 说明 |
| --- | --- | --- |
| PENDING | 待支付 | 下单初始态 |
| PAYING | 支付中 | 已发起支付、未收到回调 |
| PAID | 已支付 | 支付成功，触发履约 |
| CANCELLED | 已取消 | 用户取消/超时取消 |
| EXPIRED | 已过期 | 支付超时未付（2.0 新增） |
| REFUNDING | 退款中 | 发起退款 |
| REFUNDED | 已退款 | 退款成功 |
| COMPLETED | 已完成 | 服务履约完成 |

## 二、合法流转

```
PENDING ──支付──▶ PAYING ──回调成功──▶ PAID ──履约完成──▶ COMPLETED
   │                  │                    │
   │ 取消/超时         │ 支付失败           │ 退款
   ▼                  ▼                    ▼
CANCELLED          PENDING            REFUNDING ──▶ REFUNDED
   │(超时)                              (REFUNDING 可回 PAID 若退款失败)
   ▼
EXPIRED
```

## 三、流转规则（后端强制）

| 当前 | 目标 | 触发 | 条件 |
| --- | --- | --- | --- |
| PENDING | PAYING | 发起支付 | 合同已签署（套餐单） |
| PAYING | PAID | 支付回调验签通过 | 金额一致 + 幂等 |
| PAYING | PENDING | 支付失败/主动查询未付 | - |
| PENDING | CANCELLED | 用户取消 | 未支付 |
| PENDING/PAYING | EXPIRED | 超时（如 2h 未付） | 定时任务 |
| PAID | REFUNDING | 发起退款 | 超管/财务 |
| REFUNDING | REFUNDED | 退款回调成功 | 幂等 |
| REFUNDING | PAID | 退款失败 | - |
| PAID | COMPLETED | 项目履约完成 | 项目 COMPLETED |

## 四、非法流转（拒绝）

- PAID / REFUNDED / COMPLETED → CANCELLED（禁止）
- CANCELLED / EXPIRED → PAID（禁止，除非退款链路）
- 任何状态 → 任意状态（禁止自由跳转，必须走显式流转函数）

## 五、幂等与并发

1. `confirmPaid` 事务内二次查状态，`PAID` 直接返回 duplicated。
2. 金额不一致返回 `AMOUNT_MISMATCH`。
3. 状态冲突返回 `STATE_CONFLICT`（409）。
4. 订单号唯一（`orderNo @unique`）。

## 六、状态变更入口（集中管理）

- 建议实现 `orderState.transition(order, target, ctx)` 单一入口，禁止业务代码散落 `order.status = 'xxx'`。
- 每次流转记录 `OrderChangeLog`（现状已有）+ 操作日志。

## 七、业务副作用（状态 → 事件）

| 事件 | 触发 |
| --- | --- |
| PAID | 创建 Project + ServicePeriod + 分配负责人（幂等） |
| REFUNDED | 项目状态联动（若未开始则 CANCELLED） |
| COMPLETED | 通知客户 + 续费提醒入口 |
| EXPIRED | 释放优惠券/库存（若有） |

## 八、定时任务（建议）

- 支付超时扫描：PENDING/PAYING 超 2h → EXPIRED。
- 退款对账：REFUNDING 超时主动查询退款结果。
- 到期提醒：ServicePeriod.endAt 前 7 天通知续费。
