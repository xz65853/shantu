# 微信小程序架构

## 一、现状与缺口

- **现状**：后端 API 已较完整（`/api/miniapp/*` 约 60 个接口），覆盖登录、首页、服务、案例、订单、合同、实名、项目、日报、月报、AI 助手、以及小程序管理后台。
- **缺口（P0）**：**小程序前端代码缺失**（无 `.wxml/.wxss/.js`）。原前端位于已删除的兄弟项目，需重建。

## 二、技术选型

- **原生微信小程序**（不引入跨端框架，保持与微信生态兼容）。
- 后端复用现有 `/api/miniapp/*`，统一走 `https://chenyi.ak03.cn`。

## 三、目录结构（目标）

```
miniprogram/
├─ app.js / app.json / app.wxss
├─ project.config.json
├─ utils/
│  ├─ request.js        # 统一请求封装（Bearer token + 错误处理）
│  ├─ auth.js           # 登录态管理（token 缓存 + 失效重登）
│  └─ format.js         # 金额/日期格式化
├─ pages/
│  ├─ index/            # 首页
│  ├─ services/         # 服务列表 + 详情
│  ├─ packages/         # 套餐 + 详情
│  ├─ cases/            # 案例列表 + 详情
│  ├─ projects/         # 我的项目列表 + 详情
│  ├─ daily/            # 日报
│  ├─ reports/          # 月报
│  ├─ orders/           # 订单列表 + 详情 + 支付
│  ├─ contract/         # 合同确认 + 签署
│  ├─ realname/         # 实名认证
│  ├─ mine/             # 我的（客户中心）
│  └─ admin/            # 员工手机端管理后台（可选，WebView 或原生）
└─ components/
```

## 四、登录流程

```
wx.login → code
   ↓
POST /api/miniapp/auth/login { code }
   ↓
服务端 code2session（AppSecret 服务端持有）→ openid
   ↓
查/建 Member → 签发 JWT
   ↓
前端存 token（Storage）→ 后续请求带 Authorization: Bearer
   ↓
（可选）手机号授权绑定 → 关联 phone
```

## 五、底部导航（5 Tab）

```
首页    服务    案例    项目    我的
```

## 六、核心用户旅程

1. **下单支付**：服务详情 → 套餐 → 下单 → 实名 → 合同签署 → 微信支付（JSAPI）。
2. **履约查看**：我的项目 → 服务进度 → 日报 → 月报。
3. **续费**：项目详情 → 续费入口 → 下单 → 支付 → 新服务周期。

## 七、请求封装（关键）

```js
// utils/request.js 伪代码
function request(path, { method, data } = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE + path,
      method,
      data,
      header: { Authorization: `Bearer ${getToken()}` },
      success(res) {
        if (res.data.code === 'UNAUTHORIZED') { reLogin(); return reject(res.data) }
        if (res.data.success) resolve(res.data.data)
        else reject(res.data)
      },
      fail: reject,
    })
  })
}
```

## 八、小程序管理后台（员工手机端）

- 管理员绑定：后台生成 6 位绑定码 → 小程序「我的」输入绑定 → openid 写入 admins.open_id。
- 鉴权：Bearer member token → openid → 白名单 → 角色（`getMiniAdmin`）。
- 能力：工作台、线索、订单、项目、日报/月报填写、上传。
- 角色写权限：超管/运营/财务可写；改金额仅超管/财务。

## 九、发布注意

- 后台改小程序配置（AppID/支付/域名）后，小程序需**重新提交审核发布**才生效。
- 合法域名（request/socket/uploadFile/downloadFile）需在微信后台配置 `chenyi.ak03.cn`。
- 业务数据（套餐/服务/案例）后台改动**无需重发小程序**（数据来自 API）。
