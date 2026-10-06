import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/admin/session — 200 if the admin cookie is valid, 401 otherwise. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied
  return NextResponse.json({ ok: true })
}
