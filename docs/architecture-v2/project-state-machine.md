# 项目状态机

## 一、项目状态（Project）

| 状态 | 含义 |
| --- | --- |
| PENDING | 待开始 |
| ACTIVE | 进行中 |
| PAUSED | 暂停 |
| COMPLETED | 已完成 |
| CANCELLED | 已取消 |

> 现状为 `PENDING / RUNNING / PAUSED / DONE`，2.0 收敛为 `PENDING / ACTIVE / PAUSED / COMPLETED / CANCELLED`。

## 二、服务周期状态（ServicePeriod）

| 状态 | 含义 |
| --- | --- |
| PENDING | 未开始 |
| ACTIVE | 进行中 |
| PAUSED | 暂停 |
| COMPLETED | 已完成 |
| CANCELLED | 已取消 |

## 三、任务状态（Task）

| 状态 | 含义 |
| --- | --- |
| TODO | 待办 |
| IN_PROGRESS | 进行中 |
| COMPLETED | 已完成 |
| DELAYED | 延期 |
| CANCELLED | 已取消 |

## 四、日报状态（DailyReport）

| 状态 | 含义 |
| --- | --- |
| DRAFT | 草稿（编辑中） |
| SUBMITTED | 已提交 |
| PUBLISHED | 已发布（客户可见） |

## 五、项目流转

```
订单 PAID ──(幂等)──▶ 创建 Project(PENDING) + ServicePeriod(PENDING) + 分配负责人
                              │ 服务开始
                              ▼
                         Project ACTIVE / Period ACTIVE
                              │ 完成
                              ▼
                         Project COMPLETED / Period COMPLETED
```

- `PAUSED`：双方协商暂停（如客户临时叫停），暂停期间不计服务期。
- `CANCELLED`：项目取消（如退款后未开始的项目）。

## 六、项目自动创建（幂等）

订单 `PAID` 事件触发：
1. 检查该订单是否已创建项目（`Project.orderId` 存在则跳过）。
2. 事务内：创建 Project + ServicePeriod（startAt/endAt 按套餐 periodDays）+ 默认任务模板。
3. 分配负责人（默认或按业务规则）。
4. 通知客户「项目已建立」。

**幂等保证**：以 `orderId` 去重，重复触发直接返回已存在项目。

## 七、服务交付（后台）

```
Project
  └─ ServicePeriod（服务周期）
       └─ Task（任务，含负责人/截止日期）
```

- 客户只能看：项目状态、服务内容、进度、日报、月报。
- 客户看不到：内部备注（note）、成本、负责人内部信息。

## 八、延期处理

- 任务 `DELAYED`：截止日期已过且未完成。
- 项目/周期延期：服务周期 endAt 顺延（记录原因）。

## 九、状态变更入口

- 集中 `projectState.transition(...)` / `taskState.transition(...)`。
- 禁止散落字符串状态。
