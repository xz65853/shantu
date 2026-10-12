'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (msg: string) => void
  error: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
})

/** 全局 toast：所有后台页面共享。用法：const toast = useToast(); toast.success('保存成功') */
export function useToast() {
  return useContext(ToastContext)
}

let uid = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = uid++
      setToasts((prev) => [...prev, { id, type, message }])
      const timer = setTimeout(() => dismiss(id), 2000)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  const success = useCallback((msg: string) => push('success', msg), [push])
  const error = useCallback((msg: string) => push('error', msg), [push])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {/* 右上角固定 toast 层 */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border px-3 py-2.5 shadow-lg backdrop-blur"
            style={{
              background: t.type === 'success' ? '#F0FDF4' : '#FEF2F2',
              borderColor: t.type === 'success' ? '#BBF7D0' : '#FECACA',
            }}
            onClick={() => dismiss(t.id)}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#16A34A' }} />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" style={{ color: '#DC2626' }} />
            )}
            <span
              className="text-sm font-medium leading-tight"
              style={{ color: t.type === 'success' ? '#166534' : '#991B1B' }}
            >
              {t.message}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
