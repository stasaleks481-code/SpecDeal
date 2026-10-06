import { NextResponse } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/admin/logout — clears the admin session cookie. */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
