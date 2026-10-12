import Link from 'next/link'

const LINKS = [
  {
    title: '服务项目',
    items: [
      { href: '/services', label: '全部服务' },
      { href: '/cases', label: '成功案例' },
      { href: '/blog', label: '运营干货' },
    ],
  },
  {
    title: '关于闪途',
    items: [
      { href: '/about', label: '公司介绍' },
      { href: '/contact', label: '联系我们' },
      { href: '/admin/login', label: '管理后台' },
    ],
  },
]

export function SiteFooter({
  siteName = '桃江闪途网络科技工作室（个体工商户）',
  slogan = '实体企业线上增长服务商',
  note = '帮助实体企业，把生意搬到线上。',
  phone = '',
  email = '',
  address = '',
  icp = '',
  wechatQrcode = '',
}: {
  siteName?: string
  slogan?: string
  note?: string
  phone?: string
  email?: string
  address?: string
  icp?: string
  wechatQrcode?: string
}) {
  return (
    <footer className="mt-24 border-t border-line bg-ink text-slate-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[13px] font-bold text-ink">
              闪途
            </span>
            <span className="text-[15px] font-semibold text-white">闪途</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">{note}</p>
          <p className="mt-3 text-xs text-slate-500">{slogan}</p>
        </div>

        {LINKS.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-white">{group.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-slate-400 transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold text-white">联系方式</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
            {phone ? <li>电话：{phone}</li> : null}
            {email ? <li>邮箱：{email}</li> : null}
            {address ? <li>地址：{address}</li> : null}
          </ul>
          {wechatQrcode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wechatQrcode}
              alt="微信二维码"
              className="mt-4 h-24 w-24 rounded-lg border border-white/10 object-cover"
            />
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row">
          <span>
            © {new Date().getFullYear()} {siteName}
          </span>
          <span>{icp ? ` ${icp}` : ''}</span>
        </div>
      </div>
    </footer>
  )
}
