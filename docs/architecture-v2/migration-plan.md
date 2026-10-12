# 数据库迁移方案

> 原则：增量演进，先备份后迁移，**禁止 DROP TABLE / TRUNCATE / DELETE 解决模型问题**。

## 一、现状 → 目标映射

| 现状 | 目标 | 迁移策略 |
| --- | --- | --- |
| 无 ServicePeriod | 新增 ServicePeriod | 新建表 + 从 Project 迁移 startAt/endAt 为初始周期 |
| 无 Task | 新增 Task | 新建表，可选默认任务模板 |
| 无 Notification | 新增 Notification | 新建表 |
| 无 OrderItem | 新增 OrderItem | 新建表（可选，多商品时启用） |
| Contract 状态 3 态 | Contract 状态 8 态 | 字段值映射（PENDING→PENDING_SIGN，VOID→CANCELLED） |
| Project 状态 4 态 | 5 态 | 值映射（RUNNING→ACTIVE，DONE→COMPLETED） |
| 状态 String | enum | 收敛为 enum（迁移数据 + 校验） |
| 字段命名混用 | 统一 snake_case | @map 统一（不改列名，只改 Prisma 层映射，或谨慎 rename） |

## 二、新增表（无破坏性）

| 表 | 说明 |
| --- | --- |
| service_periods | 服务周期 |
| tasks | 任务 |
| notifications | 通知 |
| order_items | 订单明细（可选） |
| contract_signatures | 独立签名记录（可选） |

> 全部为 `CREATE TABLE`，不影响存量数据。

## 三、修改字段（兼容旧数据）

| 字段 | 变更 | 兼容策略 |
| --- | --- | --- |
| contract.status | 3 态 → 8 态 | 值映射，旧值自动迁移，新值默认 |
| project.status | RUNNING/DONE → ACTIVE/COMPLETED | 值映射 |
| 新增 status enum | String → enum | 先映射值，再切类型 |
| 金额字段类型 | Int/BigInt 统一 | 统一 BigInt，MySQL 加宽不丢数据 |

## 四、废弃字段（保留不删）

- `Member.oldNo`（历史编号）：保留，只读，不再写入。
- 其他历史字段：标记 `@deprecated` 注释，不物理删除。

## 五、数据迁移步骤（每步可回滚）

1. **备份**：mysqldump 完整备份（阶段二已完成基线）。
2. **建新表**：CREATE TABLE 新增 5 张表。
3. **回填初始周期**：为每个已有 Project 创建一条 ServicePeriod（startAt/endAt 取 Project 现有值，status 按 Project 映射）。
4. **状态值映射**：contract.status / project.status 值映射（UPDATE 一次性迁移）。
5. **切换 Prisma**：更新 schema.prisma，`prisma migrate` 生成迁移（或 db push 前先备份）。
6. **校验**：对比迁移前后数据量、抽样关键字段一致。
7. **兼容观察**：保留旧字段一段时间，确认无异常后标记废弃。

## 六、回滚方案

- 每步迁移前记录数据快照（或完整 SQL 备份）。
- 新增表：`DROP TABLE`（仅新增表，不影响存量）。
- 字段值映射：记录映射关系，可逆映射回滚。
- 类型变更：保留原类型数据，可 ALTER 回退。

## 七、验证清单

| 验证项 | 方法 |
| --- | --- |
| 表数量一致 | information_schema 对比 |
| 数据量一致 | 关键表 COUNT 对比 |
| 状态值合法 | 检查迁移后 status 均在枚举内 |
| 外键完整 | 检查无孤儿记录 |
| 业务可读 | 抽样订单/合同/项目可正常查询 |
| 网站可用 | 首页/后台/支付链路冒烟 |

## 八、禁止事项（重申）

- ❌ `prisma migrate reset`（会清库）
- ❌ `DROP TABLE` 存量表
- ❌ `TRUNCATE` / `DELETE` 清理数据
- ❌ 未备份直接迁移
- ❌ 迁移中修改支付/认证/合同逻辑
