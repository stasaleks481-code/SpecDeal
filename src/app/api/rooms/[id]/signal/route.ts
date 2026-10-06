import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { getUserAllowedForAction, ANON_ERROR } from '@/lib/server/auth-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/[id]/signal
 * Body: { type: 'offer'|'answer'|'ice'|'join'|'leave'|'mute'|'kick', payload: any, to_user_id?: number }
 *
 * Stores a WebRTC signaling message in call_signals table.
 * Clients subscribe to this table via Supabase Realtime to receive
 * signaling messages in real-time.
 *
 * Anonymous accounts cannot join voice calls (403).
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
  if (isNaN(tgId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  // Anonymous accounts cannot use voice
  const allowed = await getUserAllowedForAction(tgId, 'voice')
  if (!allowed) {
    const { data } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', tgId)
      .maybeSingle<{ account_type?: string }>()
    if (data?.account_type === 'anonymous') {
      return NextResponse.json({ error: ANON_ERROR, error_code: 'ACCOUNT_REQUIRED' }, { status: 403 })
    }
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { id: roomId } = await params
  const body = await req.json().catch(() => ({}))

  const type = body.type as string
  if (!['offer', 'answer', 'ice', 'join', 'leave', 'mute', 'kick'].includes(type)) {
    return NextResponse.json({ error: 'Invalid signal type' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('call_signals')
    .insert({
      room_id: roomId,
      from_user_id: tgId,
      to_user_id: body.to_user_id ?? null,
      type,
      payload: body.payload ?? {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('[signal] insert error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}

/**
 * GET /api/rooms/[id]/signal?after=<id>
 * Returns signaling messages for this room (for polling fallback).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const { id: roomId } = await params
  const url = new URL(req.url)
  const after = url.searchParams.get('after')

  let query = supabase
    .from('call_signals')
    .select('id, from_user_id, to_user_id, type, payload, created_at')
    .eq('room_id', roomId)
    .order('id', { ascending: true })
    .limit(100)

  if (after) {
    query = query.gt('id', parseInt(after, 10))
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Filter: only messages addressed to me OR broadcast (to_user_id null)
  const filtered = (data ?? []).filter(
    (s: { to_user_id: number | null; from_user_id: number }) =>
      s.to_user_id === null || s.to_user_id === tgId
  )

  return NextResponse.json({ signals: filtered })
}
