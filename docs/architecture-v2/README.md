# 桃江闪途项目 2.0 架构设计文档

> 阶段三产物：产品架构 + 数据架构 + API 架构设计
> 状态：**设计阶段，未进入代码开发**

## 文档索引

| # | 文档 | 说明 |
| --- | --- | --- |
| 01 | [product-architecture.md](./product-architecture.md) | 产品定位与三端整体架构 |
| 02 | [user-flow.md](./user-flow.md) | 新客户/老客户/工作人员流程 |
| 03 | [database-design.md](./database-design.md) | 核心数据模型与关系 |
| 04 | [api-design.md](./api-design.md) | API 统一契约与路由 |
| 05 | [auth-permission.md](./auth-permission.md) | 认证与 RBAC 权限 |
| 06 | [order-state-machine.md](./order-state-machine.md) | 订单状态机 |
| 07 | [contract-state-machine.md](./contract-state-machine.md) | 合同状态机 |
| 08 | [project-state-machine.md](./project-state-machine.md) | 项目状态机 |
| 09 | [payment-flow.md](./payment-flow.md) | 支付流程与幂等 |
| 10 | [mini-program-architecture.md](./mini-program-architecture.md) | 小程序架构 |
| 11 | [admin-architecture.md](./admin-architecture.md) | 管理后台架构 |
| 12 | [migration-plan.md](./migration-plan.md) | 数据库迁移方案 |

## 设计原则

1. **数据唯一真实来源**：后台修改 → 数据库 → 官网/小程序读取，改价不改小程序代码。
2. **后端权威**：金额、状态、权限一律由后端决定，前端只做展示与交互。
3. **幂等优先**：支付、回调、项目创建全部幂等。
4. **不破坏现有功能**：增量演进，先备份后迁移，禁止 DROP/TRUNCATE。
5. **状态机约束**：状态流转用枚举 + 显式状态机，禁止散落字符串。

## 三个阶段定位

| 阶段 | 产出 | 是否动代码 |
| --- | --- | --- |
| 阶段一 | 技术审计报告 | 否 |
| 阶段二 | 备份 + 安全基线 | 仅 .gitignore |
| 阶段三 | 架构设计文档（本目录） | 否 |
| 阶段四+ | 实际开发（待确认后启动） | 是 |
