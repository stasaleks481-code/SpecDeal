import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { getUserAllowedForAction, ANON_ERROR } from '@/lib/server/auth-helpers'
import { verifyVoiceToken } from '@/lib/server/games'

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
 * SECURITY:
 *  - Requires a short-lived TTL voice token (x-voice-token header) issued
 *    only to verified room members (see /api/rooms/[id]/voice-token)
 *  - Requester must be a room member
 *  - Anonymous accounts cannot join voice calls (403)
 */

/** Shared auth+membership+token validation for both handlers */
async function authorizeSignal(
  req: NextRequest,
  roomId: string
): Promise<{ tgId: number } | { error: NextResponse }> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }
  const tgId = parseInt(userId, 10)
  if (isNaN(tgId)) {
    return { error: NextResponse.json({ error: 'Invalid user id' }, { status: 400 }) }
  }

  // TTL signaling token (bound to user+room, 10 min lifetime)
  const tokenError = verifyVoiceToken(tgId, roomId, req.headers.get('x-voice-token'))
  if (tokenError) {
    return { error: NextResponse.json({ error: tokenError, error_code: 'TOKEN_INVALID' }, { status: 401 }) }
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
      return { error: NextResponse.json({ error: ANON_ERROR, error_code: 'ACCOUNT_REQUIRED' }, { status: 403 }) }
    }
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }

  // Requester must be an active member of this room
  const { data: membership } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', tgId)
    .maybeSingle()
  if (!membership) {
    return { error: NextResponse.json({ error: 'Ты не участник этой комнаты' }, { status: 403 }) }
  }

  return { tgId }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: roomId } = await params
  const auth = await authorizeSignal(req, roomId)
  if ('error' in auth) return auth.error
  const tgId = auth.tgId

  const body = await req.json().catch(() => ({}))

  const type = body.type as string
  if (!['offer', 'answer', 'ice', 'join', 'leave', 'mute', 'kick', 'close'].includes(type)) {
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
 * Returns signaling messages for this room (Realtime catch-up + polling
 * fallback).
 *
 * Without `after`: returns only signals from the LAST 5 MINUTES —
 * ancient signals from finished sessions are never replayed (they used
 * to create ghost peers stuck on "подключение...").
 * With `after`: returns everything newer than that id (polling path).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: roomId } = await params
  const auth = await authorizeSignal(req, roomId)
  if ('error' in auth) return auth.error
  const tgId = auth.tgId

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
  } else {
    // Fresh-only catch-up: last 5 minutes
    query = query.gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
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
