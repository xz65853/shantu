# API 架构设计

## 一、统一响应契约

成功：
```json
{ "success": true, "data": {}, "message": "" }
```

失败：
```json
{ "success": false, "code": "ORDER_NOT_FOUND", "message": "订单不存在" }
```

## 二、错误码枚举（集中定义，禁止散落字符串）

| code | 含义 |
| --- | --- |
| VALIDATION_ERROR | 参数校验失败 |
| UNAUTHORIZED | 未登录 |
| FORBIDDEN | 无权限 |
| NOT_FOUND | 资源不存在 |
| ORDER_NOT_FOUND | 订单不存在 |
| ORDER_ALREADY_PAID | 订单已支付 |
| ORDER_CANCELLED | 订单已取消 |
| CONTRACT_NOT_SIGNED | 合同未签署 |
| CONTRACT_VOID | 合同已作废 |
| REAL_NAME_REQUIRED | 需先实名 |
| AMOUNT_MISMATCH | 金额不一致 |
| PAYMENT_CHANNEL_UNAVAILABLE | 支付渠道未开通 |
| COUPON_INVALID | 优惠码不可用 |
| STATE_CONFLICT | 状态冲突 |
| RATE_LIMITED | 请求过于频繁 |
| INTERNAL_ERROR | 服务异常 |

## 三、HTTP 状态码约定

| 状态码 | 场景 |
| --- | --- |
| 400 | 参数错误 |
| 401 | 未登录 |
| 403 | 无权限 |
| 404 | 不存在 |
| 409 | 状态冲突（如未签合同就支付） |
| 429 | 请求过多 |
| 500 | 服务异常 |

## 四、API 路由清单（目标）

### 认证
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/auth/login | 管理员登录 |
| POST | /api/auth/logout | 管理员登出 |
| POST | /api/auth/member/login | 会员登录（手机号+密码） |
| POST | /api/auth/member/register | 会员注册 |
| POST | /api/auth/member/set-password | 设置/修改密码 |
| GET | /api/auth/member/me | 当前会员 |

### 小程序认证
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/miniapp/auth/login | 微信登录（code → openid） |
| POST | /api/miniapp/auth/phone | 手机号授权绑定 |

### 内容（公开）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/services /api/services/:slug | 服务 |
| GET | /api/cases /api/cases/:slug | 案例 |
| GET | /api/articles /api/articles/:slug | 文章 |
| GET | /api/packages | 套餐 |
| GET | /api/miniapp/home | 小程序首页聚合 |
| GET | /api/miniapp/config | 小程序配置（非敏感） |

### 交易（会员）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/orders | 下单（后端计价） |
| GET | /api/orders/:orderNo | 订单详情 |
| POST | /api/payment/create | 发起支付 |
| GET | /api/coupons/verify | 优惠码校验 |
| POST | /api/realname/start | 发起实名 |
| POST | /api/realname/confirm | 实名确认 |
| GET | /api/realname/status | 实名状态 |
| POST | /api/contracts/:id/sign | 签署合同 |
| GET | /api/contracts/:id/pdf | 合同 PDF |

### 履约（会员只读自己的）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/miniapp/projects | 我的项目 |
| GET | /api/miniapp/projects/:id | 项目详情 |
| GET | /api/miniapp/projects/:id/reports | 月报列表 |
| GET | /api/miniapp/projects/:id/daily | 日报列表 |
| GET | /api/notifications | 通知 |

### 管理后台
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| CRUD | /api/admin/leads | 线索 |
| CRUD | /api/admin/orders | 订单 |
| CRUD | /api/admin/contracts | 合同 |
| CRUD | /api/admin/projects | 项目 |
| CRUD | /api/admin/service-periods | 服务周期 |
| CRUD | /api/admin/tasks | 任务 |
| CRUD | /api/admin/projects/:id/daily-logs | 日报 |
| CRUD | /api/admin/projects/:id/reports | 月报 |
| CRUD | /api/admin/members | 会员 |
| CRUD | /api/admin/packages | 套餐 |
| CRUD | /api/admin/coupons | 优惠券 |
| CRUD | /api/admin/settings | 设置 |

## 五、越权防护规范（每个资源接口必须遵守）

所有 `:id` / `:orderNo` 资源接口，服务端必须校验资源归属：

```ts
// 订单示例
const order = await prisma.order.findUnique({ where: { orderNo } })
if (order.memberId !== currentMember.id) return fail('无权访问', 403)
```

覆盖对象：订单、合同、项目、日报、月报、通知、实名、客户资料。

## 六、统一助手（现状已具备，收敛使用）

- `ok(data, message)` / `fail(message, httpStatus?, code?)` / `handle(fn)` / `parseBody(req, schema)`（`lib/api.ts`）
- 收敛：所有接口统一走 `handle` 包裹，统一返回契约，`fail` 第三参传 `code`。

## 七、版本化与文档

- 建议后续引入 `/api/v1` 前缀（破坏性变更时新增 v2）。
- 建议补 OpenAPI 文档（或至少 route 内注释标准化）。
