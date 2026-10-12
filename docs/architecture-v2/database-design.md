# 数据库设计

> 基于现有 24 个 Prisma 模型，增量设计 2.0 目标模型。
> **本阶段只输出设计，不修改 schema.prisma。**

## 一、核心模型链

```
Member(用户)
  ↓ 1:N
Order(订单) ── 1:1 ── Contract(合同)
  ↓ 1:N
Project(项目) ── 1:N ── ServicePeriod(服务周期)
  │                         ↓ 1:N
  │                      Task(任务)
  │                         ↓
  ├── 1:N ── DailyReport(日报)
  └── 1:N ── MonthlyReport(月报)
```

## 二、模型清单（现状 → 目标）

| 模型 | 现状 | 2.0 目标 | 变更 |
| --- | --- | --- | --- |
| Admin | ✅ | ✅ | 保留，RBAC 细化 |
| Member | ✅ | ✅ | 统一用户，补 notification 关联 |
| Service/ServiceCategory | ✅ | ✅ | 保留 |
| Case/CaseCategory | ✅ | ✅ | 保留 |
| Article/ArticleCategory | ✅ | ✅ | 保留 |
| Lead/LeadFollowup | ✅ | ✅ | 保留 |
| Banner/Media/FormOption | ✅ | ✅ | 保留 |
| SiteSetting/SeoSetting/VisitLog | ✅ | ✅ | 保留 |
| Package | ✅ | ✅ | 保留 |
| Order | ✅ | ✅ | 状态机补齐，补 OrderItem |
| OrderItem | ❌ | 🆕 | 订单明细（支持多商品） |
| Payment/PaymentLog/Refund | ✅ | ✅ | 保留 |
| Contract/ContractTemplate/ContractVersion | ✅ | ✅ | 状态机补齐，补 ContractSignature |
| ContractSignature | ❌ | 🆕 | 独立签名记录 |
| Project | ✅ | ✅ | 状态机补齐 |
| ServicePeriod | ❌ | 🆕 | 服务周期 |
| Task | ❌ | 🆕 | 任务 |
| ProjectReport | ✅ | ✅ | 保留（=月报） |
| ProjectDailyLog | ✅ | ✅ | 保留（=日报），状态机补齐 |
| RealNameAuth | ✅ | ✅ | 保留 |
| Coupon | ✅ | ✅ | 保留 |
| Notification | ❌ | 🆕 | 通知 |
| AiProvider/AiCallLog/AiChatMessage | ✅ | ✅ | 补 onDelete |
| 日志/合并日志 | ✅ | ✅ | 保留 |

## 三、新增模型设计

### 1. ServicePeriod（服务周期）
```prisma
model ServicePeriod {
  id        Int      @id @default(autoincrement())
  projectId Int      @map("project_id")
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  orderId   Int?     @map("order_id")   // 关联续费订单
  packageName String? @map("package_name")
  periodDays Int      @default(31) @map("period_days")
  startAt   DateTime @map("start_at")
  endAt     DateTime @map("end_at")
  status    ServicePeriodStatus @default(PENDING) // PENDING/ACTIVE/PAUSED/COMPLETED/CANCELLED
  // 续费链：prevPeriodId 指向上一周期
  prevPeriodId Int?  @map("prev_period_id")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  tasks Task[]
  @@index([projectId, status])
  @@map("service_periods")
}
```

### 2. Task（任务）
```prisma
enum TaskStatus { TODO IN_PROGRESS COMPLETED DELAYED CANCELLED }

model Task {
  id           Int      @id @default(autoincrement())
  periodId     Int      @map("period_id")
  period       ServicePeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  title        String
  description  String?  @db.Text
  assigneeId   Int?     @map("assignee_id")  // 负责人(admin)
  dueAt        DateTime? @map("due_at")
  status       TaskStatus @default(TODO)
  completedAt  DateTime? @map("completed_at")
  sort         Int      @default(0)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([periodId, status])
  @@map("tasks")
}
```

### 3. Notification（通知）
```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  memberId  Int      @map("member_id")
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  type      String   // daily_report / monthly_report / order_paid / contract / project / renew
  title     String
  content   String?  @db.Text
  link      String?  // 跳转路径
  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([memberId, isRead, createdAt])
  @@map("notifications")
}
```

### 4. OrderItem（订单明细，可选）
```prisma
model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int     @map("order_id")
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  packageId Int?    @map("package_id")
  name      String
  price     Int     // 分
  quantity  Int     @default(1)
  amount    Int     // 分 = price * quantity
  @@index([orderId])
  @@map("order_items")
}
```

### 5. ContractSignature（独立签名记录，可选）
```prisma
model ContractSignature {
  id           Int      @id @default(autoincrement())
  contractId   Int      @map("contract_id")
  contract     Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  memberId     Int?     @map("member_id")
  signatureUrl String   @map("signature_url")
  ip           String?
  userAgent    String?  @map("user_agent")
  openid       String?
  signedAt     DateTime @default(now()) @map("signed_at")
  @@index([contractId])
  @@map("contract_signatures")
}
```

## 四、枚举状态机（集中定义）

| 枚举 | 值 |
| --- | --- |
| OrderStatus | PENDING / PAYING / PAID / CANCELLED / EXPIRED / REFUNDING / REFUNDED / COMPLETED |
| ContractStatus | DRAFT / PENDING_REAL_NAME / PENDING_CONFIRM / PENDING_SIGN / SIGNED / ACTIVE / CANCELLED / EXPIRED |
| ProjectStatus | PENDING / ACTIVE / PAUSED / COMPLETED / CANCELLED |
| ServicePeriodStatus | PENDING / ACTIVE / PAUSED / COMPLETED / CANCELLED |
| TaskStatus | TODO / IN_PROGRESS / COMPLETED / DELAYED / CANCELLED |
| DailyReportStatus | DRAFT / SUBMITTED / PUBLISHED |

## 五、关键关系与约束

1. **Order → Contract 1:1**：`Contract.orderId @unique`（保持现状）。
2. **Order → Project 1:N**：`Project.orderId` 不加 unique，一个订单可拆多项目（或保持 1:1，业务上暂按 1:1，但模型留 1:N 空间）。
3. **Project → ServicePeriod 1:N**：续费时同项目新增周期。
4. **金额统一 Int（分）**：现有 BigInt 的 gmv/views 统一收敛为 Int 或统一 BigInt，二选一（建议统一 BigInt，避免后续溢出）。
5. **软删除**：Order/Contract/Project/Member/Lead/RealNameAuth 保留 deletedAt/deletedBy/deleteReason。
6. **外键 onDelete**：新增模型统一 `onDelete: Cascade`（ServicePeriod/Task/Notification/ContractSignature），并修复 AiChatMessage 缺失的 onDelete。

## 六、索引约定

- 所有外键列建索引。
- 高频查询列：`(memberId, status)`、`(projectId, workDate)`、`(orderNo)`、`(phone)`、`(status, createdAt)`。
- 时间范围查询：`createdAt`/`startAt`/`endAt` 建索引。

## 七、命名约定（收敛）

- 表名/列名统一 snake_case（`@map`）。
- 所有字段显式 `@map`，消除 camelCase/snake_case 混用。
- 金额字段后缀统一（`_amount` / `_price`），单位统一分。
