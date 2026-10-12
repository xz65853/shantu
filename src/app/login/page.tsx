import type { Metadata } from 'next'
import { LoginForm } from '@/components/login-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '会员登录 - 桃江闪途网络科技工作室（个体工商户）',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-mist px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
              闪途
            </span>
            <div>
              <h1 className="text-lg font-semibold text-ink">会员登录 / 注册</h1>
              <p className="text-xs text-slate-400">使用手机号或会员ID + 密码登录，购买运营套餐</p>
            </div>
          </div>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          登录即表示同意我们为您提供咨询服务，信息仅用于订单与售后联系
        </p>
      </div>
    </div>
  )
}
