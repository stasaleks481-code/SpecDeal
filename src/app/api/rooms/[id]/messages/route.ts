import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { bumpQuest } from '@/lib/server/quests'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms/[id]/messages?limit=50&before=<iso>
 * Returns chat messages for a room (paginated, oldest first).
 *
 * Note: This endpoint does NOT verify membership — anyone with the room ID
 * can read messages. For tighter security, add a check that the requester
 * is a current room_member.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)
  const before = url.searchParams.get('before')

  let query = supabase
    .from('room_messages')
    .select(`
      id,
      content,
      created_at,
      sender:users!room_messages_sender_id_fkey(id, username, first_name, last_name, photo_url)
    `)
    .eq('room_id', id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Reverse to oldest-first for display
  return NextResponse.json({ messages: (data ?? []).reverse() })
}

/**
 * POST /api/rooms/[id]/messages
 * Body: { content: string }
 * Sends a chat message to a room. Sender must be authenticated.
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
  const body = await req.json().catch(() => ({}))

  const content = (body.content as string)?.trim()
  if (!content) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Message too long (max 1000)' }, { status: 400 })
  }

  // Optional: verify sender is a member of this room
  const { data: membership } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('room_id', id)
    .eq('user_id', tgId)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('room_messages')
    .insert({
      room_id: id,
      sender_id: tgId,
      content,
    })
    .select(`
      id,
      content,
      created_at,
      sender:users!room_messages_sender_id_fkey(id, username, first_name, last_name, photo_url)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Daily quest: message sent
  void bumpQuest(tgId, 'messages')

  return NextResponse.json({ message: data })
}
