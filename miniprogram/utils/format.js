// utils/format.js 格式化工具
function yuan(cents) {
  if (cents === null || cents === undefined) return '0'
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * 统一按北京时间（UTC+8）格式化，避免依赖手机时区/ISO 字符串直截导致的 8 小时偏差。
 * 后端返回 ISO UTC（如 2026-09-29T15:56:29.779Z）→ 显示 2026-09-29 23:56
 */
function beijingDate(d) {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() + 8 * 3600 * 1000)
}

function fmtDate(d) {
  const b = beijingDate(d)
  if (!b) return ''
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`
}

function fmtDateTime(d) {
  const b = beijingDate(d)
  if (!b) return ''
  return `${fmtDate(d)} ${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`
}

function maskPhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

module.exports = { yuan, fmtDate, fmtDateTime, maskPhone }
