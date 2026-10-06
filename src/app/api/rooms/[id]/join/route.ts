import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/[id]/join
 * Add current user to room members. Refuses if room is full.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const { id } = await params

  // Get room + current member count
  const { data: room } = await supabase
    .from('rooms')
    .select('id, max_players, is_active, host_id')
    .eq('id', id)
    .maybeSingle()

  if (!room || !room.is_active) {
    return NextResponse.json({ error: 'Room not found or closed' }, { status: 404 })
  }

  const { count: currentCount } = await supabase
    .from('room_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('room_id', id)

  if ((currentCount ?? 0) >= room.max_players) {
    return NextResponse.json({ error: 'Room is full' }, { status: 400 })
  }

  // Insert membership — on conflict do nothing (already member)
  const { error } = await supabase
    .from('room_members')
    .upsert({
      room_id: id,
      user_id: tgId,
      joined_at: new Date().toISOString(),
      is_ready: false,
    })

  if (error) {
    console.error('[join] error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
