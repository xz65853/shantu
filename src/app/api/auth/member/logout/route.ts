import { NextResponse } from 'next/server'
import { MEMBER_COOKIE } from '@/lib/member-auth'

export async function POST() {
  const res = NextResponse.json({ code: 0, message: 'success', data: null })
  res.cookies.set(MEMBER_COOKIE, '', { maxAge: 0, path: '/' })
  return res
}
