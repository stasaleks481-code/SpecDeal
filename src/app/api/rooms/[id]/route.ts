import { NextRequest, NextResponse } from 'next/server'
import { supabase, type RoomRow, type UserRow, GAMES } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms/[id]
 * Returns room details + members + host info.
 *
 * Ghost-room / offline-host protection:
 *  - Empty room (no members) older than 2 minutes → closed
 *  - Host offline (> 2 min) and NOT a member anymore → host transfers
 *    to the earliest remaining member (or the room closes if empty)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  const { data, error } = await supabase
    .from('rooms')
    .select(`
      *,
      host:users!rooms_host_id_fkey(id, username, first_name, last_name, photo_url, last_seen_at),
      members:room_members(
        user_id,
        joined_at,
        is_ready,
        user:users!room_members_user_id_fkey(id, username, first_name, last_name, photo_url)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  const members = (data.members ?? []) as { user_id: number; joined_at: string; is_ready: boolean; user: unknown }[]
  const now = Date.now()

  // ── Host-offline / empty-room maintenance ─────────────────────────
  if (data.is_active) {
    const hostIsMember = members.some((m) => m.user_id === data.host_id)
    const hostSeen = data.host?.last_seen_at ? new Date(data.host.last_seen_at).getTime() : 0
    const hostOffline = now - hostSeen > 2 * 60 * 1000 // 2 min

    if (members.length === 0) {
      // Empty room — close it after a short grace period
      const age = now - new Date(data.created_at).getTime()
      if (age > 2 * 60 * 1000) {
        await supabase
          .from('rooms')
          .update({ is_active: false, closed_at: new Date().toISOString() })
          .eq('id', id)
        data.is_active = false
      }
    } else if (!hostIsMember && hostOffline) {
      // Creator went offline and is no longer in the room → transfer host
      const next = [...members].sort(
        (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      )[0]
      if (next) {
        await supabase.from('rooms').update({ host_id: next.user_id }).eq('id', id)
        data.host_id = next.user_id
      } else {
        await supabase
          .from('rooms')
          .update({ is_active: false, closed_at: new Date().toISOString() })
          .eq('id', id)
        data.is_active = false
      }
    }
  }

  // Determine game info if game room
  const game = data.game_name ? GAMES.find((g) => g.code === data.game_name) : null

  return NextResponse.json({
    room: data as RoomRow,
    game,
    members: (data.members ?? []).map((m: Record<string, unknown>) => ({
      user_id: m.user_id,
      joined_at: m.joined_at,
      is_ready: m.is_ready,
      user: m.user,
    })),
    host: data.host,
  })
}

/**
 * DELETE /api/rooms/[id]
 * Closes the room (host only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  // Verify host
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id, is_active')
    .eq('id', id)
    .maybeSingle()

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.host_id !== parseInt(userId, 10)) {
    return NextResponse.json({ error: 'Only host can close room' }, { status: 403 })
  }

  const { error } = await supabase
    .from('rooms')
    .update({ is_active: false, closed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * PATCH /api/rooms/[id]
 * Update room metadata (host only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  // Verify host
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id, category')
    .eq('id', id)
    .maybeSingle()

  if (!room || room.host_id !== parseInt(userId, 10)) {
    return NextResponse.json({ error: 'Only host can update' }, { status: 403 })
  }

  const updates: Partial<RoomRow> = {}
  if (body.title) updates.title = String(body.title).slice(0, 50)
  if (body.max_players) updates.max_players = Math.max(2, Math.min((room as { category?: string } | null)?.category === 'party' ? 12 : 5, parseInt(body.max_players, 10)))

  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ room: data })
}
