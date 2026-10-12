import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: '后台登录',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-5">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
            闪途
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">闪途管理后台</h1>
          <p className="mt-1.5 text-sm text-slate-500">请使用管理员账号登录</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-400">
          本页禁止搜索引擎收录，操作记录仅内部可见
        </p>
      </div>
    </div>
  )
}
