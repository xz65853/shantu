const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://chenyi.ak03.cn").replace(/\/$/, "")
export function fullUrl(p?: string | null) {
  if (!p) return null
  if (p.startsWith("http")) return p
  return SITE + (p.startsWith("/") ? p : "/" + p)
}
