# 认证与权限设计

## 一、认证架构（现状已具备，2.0 收敛）

### 会话模型
| 对象 | 载体 | 密钥 | 有效期 |
| --- | --- | --- | --- |
| 管理员 | HttpOnly Cookie + JWT(HS256) | AUTH_SECRET | 7 天 |
| 会员（官网） | HttpOnly Cookie + JWT | `${AUTH_SECRET}:member` | 7 天 |
| 会员（小程序） | `Authorization: Bearer <token>` | `${AUTH_SECRET}:member` | 7 天 |
| 数据加密 | AES-256-GCM | APP_ENC_KEY（独立，回退 AUTH_SECRET） | - |

### 登录链路
- **管理员**：账号密码 → bcrypt 校验 → 签发 JWT → Cookie。
- **会员（官网）**：手机号 + 密码（bcrypt）→ JWT。
- **会员（小程序）**：`wx.login` → code2session（服务端持 AppSecret）→ openid → 查/建 Member → JWT。
- **小程序管理端**：Bearer member token → openid → `admins.open_id` 白名单 → 角色。

### 2.0 增强（待开发）
1. **刷新令牌/主动吊销**：JWT 增加 `jti` + 服务端 session 表，支持管理员改密/禁用后即时失效。
2. **登录限流**：管理员登录失败限流（同 IP + 同用户名），防爆破。
3. **会员 token 吊销**：会员拉黑（BLOCKED）后即时失效（当前靠查库，需确认全接口覆盖）。

## 二、权限架构（RBAC）

### 角色
| 角色 | 权限范围 |
| --- | --- |
| SUPER_ADMIN | 全部（含密钥配置、回收站、日志、管理员） |
| OPERATOR | 内容 + 订单 + 会员 + 项目 + 套餐（不含密钥/设置/管理员） |
| SALES | 线索 + 订单 + 会员 + 工作台 |
| FINANCE | 订单 + 会员 + 套餐 + 工作台（看金额，不看客户隐私） |
| READONLY | 只读查看 |

### 权限模型（三层）
1. **前端权限**：路由/按钮按角色显隐（体验层）。
2. **API 权限**：每个接口 `requirePermission(key)` 硬校验（安全层）。
3. **资源权限**：数据归属校验（`memberId === currentUser.id`），防 IDOR。

### 权限 Key（收敛现有 + 新增）
```
cases services articles media banners leads settings admins forms dashboard
wechat packages orders payment members projects recycle logs
# 2.0 新增
service-periods tasks daily-reports monthly-reports notifications realname
```

### SUPER_ONLY 模块（仅超管）
`wechat` / `payment` / `admins` / `settings` / `recycle` / `logs`

### 金额操作权限
- 修改订单金额：仅 `SUPER_ADMIN` / `FINANCE`（`AMOUNT_ROLES`）。

## 三、越权防护（IDOR 测试清单）

以下资源接口，必须校验归属，用户 A 不能访问用户 B：

| 资源 | 归属字段 | 校验 |
| --- | --- | --- |
| 订单 orderNo | order.memberId | `=== currentMember.id` |
| 合同 contractId | 通过 order → memberId | 同上 |
| 项目 projectId | project.memberId | 同上 |
| 日报/月报 | 通过 project → memberId | 同上 |
| 通知 notificationId | notification.memberId | 同上 |
| 实名记录 | realNameAuth.memberId | 同上 |

## 四、密钥安全规范

1. 生产密钥不进代码、不进 Git、不提交 .env。
2. 微信 AppSecret/APIv3 密钥/商户私钥 AES-256-GCM 加密落库（现状已实现）。
3. 后台回显只给掩码，明文永不回传前端（现状已实现）。
4. `APP_ENC_KEY` 与 `AUTH_SECRET` 职责分离（现状已实现，需在生产显式配置两者）。
