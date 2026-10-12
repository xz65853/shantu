/**
 * 清洗显示名：去掉 emoji/国旗/特殊符号，保留中英文数字和常见标点
 */
export function sanitizeName(name: string | null | undefined, maxLen = 12): string {
  if (!name) return ""
  let s = name
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uFE00-\uFE0F]/g, "")
    .replace(/[\u200D]/g, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .trim()
  s = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s._\-·]/g, "").trim()
  if (!s) return "微信用户"
  if (s.length > maxLen) s = s.slice(0, maxLen)
  return s
}
