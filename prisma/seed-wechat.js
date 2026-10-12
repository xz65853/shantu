// 一次性脚本：把微信公众号/小程序与微信支付配置写入 site_settings
// 服务器上执行：node prisma/seed-wechat.js
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

const ALGO = 'aes-256-gcm'
const ENC_PREFIX = 'enc:v1:'

function secretKey() {
  const raw = process.env.AUTH_SECRET || 'shantu-default-secret'
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptSecret(plain) {
  if (!plain) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, secretKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `${ENC_PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

// 普通字段直接存
const SETTINGS = {
  wxapp_enable: '1',
  wxapp_name: '闪途文化传媒',
  wxapp_appid: 'wx58cccddded62c55b',
  wxapp_intro: '抖音代运营｜短视频｜直播｜本地生活｜广告投放，实体企业线上增长服务商。',
  wxapp_env: '开发版',
  wxapp_audit_status: '未提交',
  wxapp_version: '1.1.0',
  // 开发阶段先走服务器 IP，备案后改为 https 域名
  wxapp_api_base: 'http://47.111.128.91:8008',
  wxpay_enable: '1',
  wxpay_mode: '直连商户',
  wxpay_mchid: '1724445840',
  // 证书序列号是公开信息，不加密
  wxpay_cert_serial: '28C0E9569E7670F37152796F06DD671E8E37807D',
  wxpay_notify_url: 'https://47.111.128.91:8008/api/pay/wxpay/notify',
}

// 支付渠道（pay_ 前缀）
const PAY_SETTINGS = {
  pay_wechat_enable: '1',
  pay_wxpay_online_enable: '1',
  pay_alipay_enable: '0',
  pay_epay_enable: '0',
  pay_offline_enable: '1',
}

// 敏感字段加密后存
const SECRET_SETTINGS = {
  wxapp_secret: '34d7c591013083f654df0e182d06cfd7',
  wxpay_api_v3_key: 'Caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  // 注意：这是私钥文件路径；也可把 apiclient_key.pem 全文粘贴到这里
  wxpay_private_key: '/www/wwwroot/shantu-website/ceat',
}

async function main() {
  let count = 0
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    count++
  }
  for (const [key, value] of Object.entries(SECRET_SETTINGS)) {
    const stored = encryptSecret(value)
    await prisma.siteSetting.upsert({ where: { key }, update: { value: stored }, create: { key, value: stored } })
    count++
  }
  for (const [key, value] of Object.entries(PAY_SETTINGS)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    count++
  }
  console.log(`已写入 ${count} 项微信/支付配置`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
