import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/[id]/leave
 * Remove current user from room. If host leaves, transfer or close.
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

  // Remove membership
  const { error } = await supabase
    .from('room_members')
    .delete()
    .eq('room_id', id)
    .eq('user_id', tgId)

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Check if user was host — if so, transfer to next member or close room
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id, is_active')
    .eq('id', id)
    .maybeSingle()

  if (room && room.host_id === tgId && room.is_active) {
    // Find next member
    const { data: remaining } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', id)
      .order('joined_at', { ascending: true })
      .limit(1)

    if (remaining && remaining.length > 0) {
      // Transfer host
      await supabase
        .from('rooms')
        .update({ host_id: remaining[0].user_id })
        .eq('id', id)
    } else {
      // No one left — close the room
      await supabase
        .from('rooms')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('id', id)
    }
  }

  return NextResponse.json({ ok: true })
}
