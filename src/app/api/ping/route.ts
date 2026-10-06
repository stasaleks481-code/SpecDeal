import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/ping
 * Heartbeat — updates user's is_online=true + last_seen_at.
 * Client calls this every 30 seconds while the app is visible.
 *
 * Also sweeps STALE online flags: users whose last_seen_at is older
 * than 2 minutes get flipped to is_online=false. This is the server-side
 * guarantee that nobody stays "online" after a hard WebView kill.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const id = parseInt(userId, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('users')
    .update({ is_online: true, last_seen_at: now })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Lazy GC sweep: flip users offline if their heartbeat is stale (> 2 min).
  // Wrapped in try/catch — sweep failure must never break the ping.
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    void supabase
      .from('users')
      .update({ is_online: false })
      .eq('is_online', true)
      .lt('last_seen_at', cutoff)
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true })
}
