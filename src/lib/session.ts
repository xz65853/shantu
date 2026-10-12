import { SignJWT, jwtVerify } from 'jose'

export type SessionPayload = {
  id: number
  username: string
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'SALES' | 'FINANCE' | 'READONLY'
  name: string
}

export const SESSION_COOKIE = 'shantu_admin_session'

/**
 * JWT 会话签名密钥
 *
 * 【安全】原实现为 `process.env.AUTH_SECRET || 'shantu-default-secret'`，
 * 一旦环境变量缺失就会静默降级到一个写死在源码里的公开弱密钥，
 * 攻击者可用它签发任意 role 的管理员会话（等价于后台完全失守）。
 * 改为 fail-fast：缺失即抛错，宁可 500 也绝不使用可预测的默认值。
 *
 * 注意：本密钥【不要】用于业务数据加密，见 wechat-settings.ts 的 APP_ENC_KEY。
 */
function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) {
    throw new Error('[session] AUTH_SECRET 未配置，拒绝启动（禁止回退到弱密钥）')
  }
  return new TextEncoder().encode(s)
}

export async function createSessionToken(payload: SessionPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload || typeof payload.id !== 'number') return null
    return {
      id: payload.id as number,
      username: String(payload.username ?? ''),
      role: (payload.role as SessionPayload['role']) ?? 'OPERATOR',
      name: String(payload.name ?? ''),
    }
  } catch {
    return null
  }
}
