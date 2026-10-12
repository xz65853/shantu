# 合同状态机

## 一、状态定义（2.0 完整版）

| 状态 | 含义 |
| --- | --- |
| DRAFT | 草稿（后台编辑中） |
| PENDING_REAL_NAME | 待实名（签署前需实名） |
| PENDING_CONFIRM | 待客户确认（客户浏览合同） |
| PENDING_SIGN | 待签署（客户确认后待签名） |
| SIGNED | 已签署 |
| ACTIVE | 已生效（服务开始） |
| CANCELLED | 已取消 |
| EXPIRED | 已过期（服务结束） |

> 现状仅 `PENDING / SIGNED / VOID` 三态，2.0 扩展为 8 态（VOID 语义并入 CANCELLED）。

## 二、合法流转

```
DRAFT ──生成──▶ PENDING_REAL_NAME
                   │ 实名通过
                   ▼
              PENDING_CONFIRM
                   │ 客户确认
                   ▼
               PENDING_SIGN
                   │ 签名图提交
                   ▼
                 SIGNED ──服务开始──▶ ACTIVE ──服务结束──▶ EXPIRED
                   │
                   │ 双方取消
                   ▼
                CANCELLED
```

## 三、与实名/支付的时序约束

1. 合同生成需订单信息（套餐服务项快照）。
2. `PENDING_REAL_NAME → PENDING_CONFIRM`：要求会员实名认证已 VERIFIED。
3. 支付前置：仅 `SIGNED`/`ACTIVE` 状态允许支付（套餐单后端硬校验）。
4. 签名信息（签名图/IP/UA/openid/昵称）落 `ContractSignature` 留痕。

## 四、合同版本

- 后台每次编辑合同 `version + 1`，写 `ContractVersion`（记录 field 前后 diff）。
- 客户签署的是**特定版本**，版本变更不追溯已签合同。

## 五、状态变更入口

- 集中 `contractState.transition(contract, target, ctx)`。
- 禁止散落 `contract.status = 'xxx'`。

## 六、合同内容快照

- 签署时固化：服务项清单（servicesJson）、金额、服务周期（periodStart/End）、服务天数。
- 套餐后续改价/改服务项**不影响历史合同**（快照已落地，现状已实现）。

## 七、作废/取消

- 取消需记录原因 + 操作人（复用 deletedBy/deleteReason 或新增 cancelReason）。
- 已 SIGNED 合同取消需谨慎（可能涉及退款联动）。
