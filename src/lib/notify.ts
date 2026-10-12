import { getSetting } from './settings'

type LeadPayload = {
  name?: string | null
  phone: string
  company?: string | null
  industry?: string | null
  message?: string | null
  source?: string | null
}

/** 手机号脱敏（用于日志，不用于推送） */
export function maskPhone(phone: string) {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

/**
 * 新线索实时推送：企业微信群机器人 webhook（后台「网站设置」里配置 notify_webhook）。
 * 推送失败不影响主流程；日志中手机号脱敏。
 */
export async function notifyNewLead(lead: LeadPayload) {
  try {
    const webhook = await getSetting('notify_webhook')
    if (!webhook) return
    const content = [
      '🔔 新线索提醒（5 分钟内跟进）',
      `姓名：${lead.name || '未填写'}`,
      `手机号：${lead.phone}`,
      lead.company ? `公司：${lead.company}` : '',
      lead.industry ? `行业：${lead.industry}` : '',
      lead.message ? `需求：${lead.message.slice(0, 100)}` : '',
      `来源：${lead.source || '官网'}`,
    ]
      .filter(Boolean)
      .join('\n')
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content } }),
      signal: AbortSignal.timeout(5000),
    })
    console.log('[notify] lead pushed', maskPhone(lead.phone))
  } catch (err) {
    console.warn('[notify] lead push failed', maskPhone(lead.phone), err instanceof Error ? err.message : '')
  }
}

/** 登录异常告警：同 IP 短时间多次登录失败，推给超管（后台配置 login_alert_webhook） */
export async function notifyLoginAlert(params: { ip: string; username: string; failCount: number }) {
  try {
    const webhook = await getSetting('login_alert_webhook')
    if (!webhook) return
    const content = [
      '🚨 后台登录异常告警',
      `IP：${params.ip}`,
      `账号：${params.username}`,
      `1 分钟内失败 ${params.failCount} 次，疑似暴力破解，请关注。`,
    ].join('\n')
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content } }),
      signal: AbortSignal.timeout(5000),
    })
    console.log('[notify] login alert sent', params.ip)
  } catch (err) {
    console.warn('[notify] login alert failed', err instanceof Error ? err.message : '')
  }
}
