import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/ping
 * Heartbeat — updates user's is_online=true + last_seen_at.
 * Client calls this every 30 seconds while the app is visible.
 *
 * Also sweeps (throttled to once per 30 s per server instance):
 *  1. Stale online flags: last_seen_at older than 2 min → is_online=false.
 *  2. Ghost room members: memberships of users whose heartbeat stopped
 *     (> 2.5 min, i.e. app closed / WebView killed mid-call) are deleted,
 *     so room counters drop back to the real number of people.
 *  3. Empty active rooms older than 3 min → closed (no ghost "2/2").
 */

/** Module-level throttle — sweep runs at most every 30 s */
let lastSweepAt = 0

const MEMBER_STALE_MS = 2.5 * 60 * 1000
const EMPTY_ROOM_CLOSE_MS = 3 * 60 * 1000

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

  // Lazy GC sweep — wrapped in try/catch: sweep failure must never break the ping.
  try {
    if (Date.now() - lastSweepAt > 30_000) {
      lastSweepAt = Date.now()

      // 1. Flip stale online flags (server-authoritative presence)
      const onlineCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      void supabase
        .from('users')
        .update({ is_online: false })
        .eq('is_online', true)
        .lt('last_seen_at', onlineCutoff)

      // 2. Ghost member cleanup: users with a dead heartbeat lose their
      //    room memberships → counters update in realtime via
      //    Supabase Realtime (room_members is in the publication).
      const memberCutoff = new Date(Date.now() - MEMBER_STALE_MS).toISOString()
      const { data: staleUsers } = await supabase
        .from('users')
        .select('id')
        .lt('last_seen_at', memberCutoff)
        .limit(500)

      const staleIds = (staleUsers ?? []).map((u: { id: number }) => u.id)
      if (staleIds.length > 0) {
        await supabase.from('room_members').delete().in('user_id', staleIds)
      }

      // 3. Close active rooms that are now empty (and old enough that it
      //    isn't a create→refetch race)
      const { data: activeRooms } = await supabase
        .from('rooms')
        .select('id')
        .eq('is_active', true)
        .is('closed_at', null)
        .lt('created_at', new Date(Date.now() - EMPTY_ROOM_CLOSE_MS).toISOString())
        .limit(100)

      for (const r of (activeRooms ?? []) as { id: string }[]) {
        const { count } = await supabase
          .from('room_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('room_id', r.id)
        if (count === 0) {
          await supabase
            .from('rooms')
            .update({ is_active: false, closed_at: new Date().toISOString() })
            .eq('id', r.id)
          await supabase
            .from('game_sessions')
            .update({ phase: 'finished' })
            .eq('room_id', r.id)
        }
      }
    }
  } catch {
    // ignore — best effort
  }

  return NextResponse.json({ ok: true })
}
