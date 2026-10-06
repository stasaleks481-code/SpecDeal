import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_S, createAdminToken, verifyAdminPassword } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/login { password }
 * Sets the signed admin cookie on success.
 * Rate-limited: simple in-memory throttle (5 attempts / 5 min per IP).
 */

const attempts = new Map<string, { count: number; reset: number }>()

function throttled(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 5 * 60 * 1000 })
    return false
  }
  entry.count += 1
  return entry.count > 5
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (throttled(ip)) {
    return NextResponse.json(
      { error: 'Слишком много попыток — подожди 5 минут' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const password = String(body.password ?? '')

  const ok = await verifyAdminPassword(password)
  if (!ok) {
    // Small delay to slow down brute force
    await new Promise((r) => setTimeout(r, 600))
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  }

  attempts.delete(ip)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_TTL_S,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
