import crypto from 'crypto'

/**
 * 应用级密钥的统一入口
 *
 * 【历史问题】
 * wechat-settings.ts / payment-settings.ts / realname.ts / session.ts 各自
 * 写了一份 `process.env.AUTH_SECRET || 'shantu-default-secret'`，带来两个隐患：
 *
 *   1) 回退值写死在源码里，而源码进过公开仓库 —— 任何拿到源码的人可用它
 *      伪造任意角色的管理员会话，并解开支付密钥、实名核验密钥的密文；
 *   2) 会话签名密钥与数据加密密钥共用同一个值，任一方轮换都会牵连另一方
 *      （轮换会话密钥 ⇒ 存量密文全部解不开 ⇒ 支付与实名核验当场瘫痪）。
 *
 * 【现在】
 *   - 数据加密统一使用独立变量 APP_ENC_KEY；
 *   - 未设置时回退 AUTH_SECRET，用于平滑迁移（存量密文尚未重加密时仍可读）；
 *   - 两者皆缺失则 fail-fast 抛错，绝不降级到任何可预测的默认值。
 *
 * 会话签名密钥见 session.ts（同样已移除回退，此处不再导出以免被误用）。
 */
export function appEncryptionKey(): Buffer {
  const raw = process.env.APP_ENC_KEY || process.env.AUTH_SECRET
  if (!raw) {
    throw new Error(
      '[app-crypto] APP_ENC_KEY / AUTH_SECRET 均未配置，拒绝使用弱密钥（请检查环境变量）',
    )
  }
  return crypto.createHash('sha256').update(raw).digest()
}
