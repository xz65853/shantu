# 桃江闪途 - 数字营销服务系统

抖音代运营公司官网 + 管理后台 + 微信小程序。

## 技术栈

- **前端/后端**：Next.js 14 (App Router) + Prisma ORM
- **数据库**：MySQL
- **小程序**：原生微信小程序
- **部署**：PM2 + Nginx 反代，跑在 127.0.0.1:3008

## 功能

### 前台官网
- 首页、服务介绍、案例、文章
- 套餐展示与下单
- 表单留资

### 管理后台 (/admin)
- 工作台数据看板
- 会员/订单/合同/项目管理
- 套餐 SKU 配置
- 合同模板管理
- 日报月报（按服务类型配置字段）
- AI 数据顾问（多模态截图识别）
- 广告监测（腾讯广告归因）
- IP 归属地、访问分析
- 水印配置
- 操作日志、回收站

### 微信小程序
- 微信一键登录（手机号+头像昵称）
- 套餐下单 → 实名认证 → 电子合同签署（手写签名）→ 微信支付
- 我的项目：日报月报时间线
- AI 数据顾问（上传千川/抖音截图自动分析）
- 我的合同、我的订单

## 安装部署

### 1. 环境要求
- Node.js 20+
- MySQL 8.0+
- Nginx
- PM2

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env，填写：
# DATABASE_URL="mysql://user:pass@127.0.0.1:3306/db"
# 微信小程序 AppID/AppSecret
# 微信支付商户号/密钥
# 阿里云二要素 API
# AI 大模型 API Key
```

### 3. 安装依赖
```bash
npm install
npx prisma migrate deploy
npx prisma db seed
```

### 4. 构建
```bash
npm run build
```

### 5. 启动
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 6. Nginx 反代
```nginx
server {
    listen 443 ssl;
    server_name chenyi.ak03.cn;
    location / {
        proxy_pass http://127.0.0.1:3008;
    }
}
```

## 目录结构

```
src/
├── app/
│   ├── (site)/          # 前台官网
│   ├── admin/           # 管理后台
│   └── api/             # API 接口
├── components/          # 公共组件
├── lib/                 # 工具库
prisma/
└── schema.prisma        # 数据库模型
tujing-miniprogram/      # 微信小程序源码
```

## 品牌

桃江闪途网络科技工作室（个体工商户）
