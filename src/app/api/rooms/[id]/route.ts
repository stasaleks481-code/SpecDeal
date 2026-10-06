import { NextRequest, NextResponse } from 'next/server'
import { supabase, type RoomRow, type UserRow, GAMES } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms/[id]
 * Returns room details + members + host info
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
      host:users!rooms_host_id_fkey(id, username, first_name, last_name, photo_url),
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
    .select('host_id')
    .eq('id', id)
    .maybeSingle()

  if (!room || room.host_id !== parseInt(userId, 10)) {
    return NextResponse.json({ error: 'Only host can update' }, { status: 403 })
  }

  const updates: Partial<RoomRow> = {}
  if (body.title) updates.title = String(body.title).slice(0, 50)
  if (body.max_players) updates.max_players = Math.max(2, Math.min(5, parseInt(body.max_players, 10)))

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
