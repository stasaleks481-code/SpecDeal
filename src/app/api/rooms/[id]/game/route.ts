import { NextRequest, NextResponse } from 'next/server'
import { supabase, PARTY_GAMES, type RoomRow } from '@/lib/supabase/client'
import {
  dealState, sanitizeState, advanceTurn, turnExpired, isTurnGame,
  type GameEngineState, type TurnAdvanceResult,
} from '@/lib/server/games'
import { getUserAllowedForAction, ANON_ERROR } from '@/lib/server/auth-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/rooms/[id]/game
 *   → { session: GameSessionRow | null, view: SanitizedView | null }
 *   The state is SANITIZED per-user: private roles/cards stay server-side.
 *   Expired turns are auto-advanced server-side (idempotent).
 *
 * POST /api/rooms/[id]/game   (host unless noted)
 *   Body: { action: 'start' | 'restart' | 'stop' | 'end_turn' | 'phase' | 'sync',
 *           game_type?, auto_mute?, phase? }
 *
 *   start   — deal a new game for current members (host)
 *   restart — re-deal (host)
 *   stop    — finish the session (host)
 *   end_turn— advance to the next speaker (current speaker or host)
 *   phase   — mafia only: { phase: 'night' | 'day' } (host)
 *   sync    — any member: advance expired turns (also fired on GET)
 *
 * Auto-mute: when a turn advances with auto_mute enabled, force-mute
 * signals are broadcast to everyone except the new speaker.
 */

async function getSession(roomId: string) {
  const { data } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function getMemberIds(roomId: string): Promise<number[]> {
  const { data } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
  return (data ?? []).map((m: { user_id: number }) => m.user_id)
}

/** Room members and the host may access the game state */
async function isRoomParticipant(roomId: string, userId: number): Promise<boolean> {
  const { count } = await supabase
    .from('room_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('user_id', userId)
  if ((count ?? 0) > 0) return true
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id')
    .eq('id', roomId)
    .maybeSingle()
  return room?.host_id === userId
}

/** Broadcast force-mute / release signals for a new speaker */
async function broadcastMute(
  roomId: string,
  hostId: number,
  muteTargets: number[],
  unmuteTarget: number | null
) {
  const rows: Record<string, unknown>[] = []
  for (const uid of muteTargets) {
    rows.push({
      room_id: roomId, from_user_id: hostId, to_user_id: uid,
      type: 'mute', payload: { force: true, auto: true },
    })
  }
  if (unmuteTarget !== null && unmuteTarget !== undefined) {
    rows.push({
      room_id: roomId, from_user_id: hostId, to_user_id: unmuteTarget,
      type: 'mute', payload: { force: false, auto: true },
    })
  }
  if (rows.length > 0) {
    await supabase.from('call_signals').insert(rows)
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const tgId = parseInt(userId, 10)

  const { id: roomId } = await params

  const { data: room } = await supabase
    .from('rooms').select('id, host_id, is_active, game_type, game_settings')
    .eq('id', roomId).maybeSingle()
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (!(await isRoomParticipant(roomId, tgId))) {
    return NextResponse.json({ error: 'Ты не участник этой комнаты' }, { status: 403 })
  }

  let session = await getSession(roomId)
  if (!session) return NextResponse.json({ session: null, view: null })

  const isHost = room.host_id === tgId
  const gameType = session.game_type as string

  // Auto-advance expired turns (idempotent — whoever hits it first wins)
  let state = session.state as GameEngineState
  if (session.phase === 'playing' && isTurnGame(gameType) && turnExpired(state)) {
    const memberIds = await getMemberIds(roomId)
    const res: TurnAdvanceResult = advanceTurn(gameType, state, memberIds)
    if (res.changed) {
      const { data: updated } = await supabase
        .from('game_sessions')
        .update({ state: res.state, updated_at: new Date().toISOString() })
        .eq('id', session.id)
        .select('*')
        .maybeSingle()
      if (updated) {
        state = updated.state as GameEngineState
        session = updated
        await broadcastMute(roomId, room.host_id, res.muteTargets, res.unmuteTarget)
      }
    }
  }

  const view = sanitizeState(gameType, state, tgId, isHost)
  return NextResponse.json({ session, view })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const tgId = parseInt(userId, 10)
  if (isNaN(tgId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })

  const { id: roomId } = await params
  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  const { data: room } = await supabase
    .from('rooms').select('id, host_id, is_active, game_type, game_settings')
    .eq('id', roomId).maybeSingle<RoomRow & { game_settings: { auto_mute?: boolean } | null }>()
  if (!room || !room.is_active) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (!(await isRoomParticipant(roomId, tgId))) {
    return NextResponse.json({ error: 'Ты не участник этой комнаты' }, { status: 403 })
  }

  const isHost = room.host_id === tgId

  // sync is allowed for any member; the rest require the host or speaker role
  if (action === 'sync') {
    const session = await getSession(roomId)
    if (!session) return NextResponse.json({ session: null })
    const gameType = session.game_type as string
    if (session.phase === 'playing' && isTurnGame(gameType)) {
      let state = session.state as GameEngineState
      if (turnExpired(state)) {
        const memberIds = await getMemberIds(roomId)
        const res = advanceTurn(gameType, state, memberIds)
        if (res.changed) {
          await supabase.from('game_sessions')
            .update({ state: res.state, updated_at: new Date().toISOString() })
            .eq('id', session.id)
          await broadcastMute(roomId, room.host_id, res.muteTargets, res.unmuteTarget)
          state = res.state
        }
      }
      const view = sanitizeState(gameType, state, tgId, isHost)
      return NextResponse.json({ session, view })
    }
    const view = sanitizeState(gameType, session.state as GameEngineState, tgId, isHost)
    return NextResponse.json({ session, view })
  }

  // ── host-only actions ────────────────────────────────────────────
  if (!isHost) {
    return NextResponse.json({ error: 'Только хост может управлять игрой' }, { status: 403 })
  }

  if (action === 'start' || action === 'restart') {
    // Anonymous never gets here (host must be verified) — enforce anyway
    const host = await getUserAllowedForAction(tgId, 'voice')
    if (!host) {
      return NextResponse.json({ error: ANON_ERROR, error_code: 'ACCOUNT_REQUIRED' }, { status: 403 })
    }

    const gameType = (body.game_type ?? room.game_type ?? '') as string
    const def = PARTY_GAMES.find((g) => g.code === gameType)
    if (!def) return NextResponse.json({ error: 'Unknown game type' }, { status: 400 })

    const memberIds = await getMemberIds(roomId)
    if (memberIds.length < def.minPlayers) {
      return NextResponse.json(
        { error: `Нужно минимум ${def.minPlayers} игрока для «${def.name}»` },
        { status: 400 }
      )
    }

    const autoMute = body.auto_mute !== undefined
      ? Boolean(body.auto_mute)
      : room.game_settings?.auto_mute !== false

    const state = dealState(gameType, memberIds, { auto_mute: autoMute })

    // One session per room: replace existing
    await supabase.from('game_sessions').delete().eq('room_id', roomId)
    const { data: session, error } = await supabase
      .from('game_sessions')
      .insert({
        room_id: roomId,
        game_type: gameType,
        phase: 'playing',
        state,
        created_by: tgId,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[game] start error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // First speaker gets the mic, everyone else force-muted (turn games)
    if (isTurnGame(gameType) && autoMute) {
      const res = advanceTurn(gameType, state, memberIds, 0)
      await broadcastMute(roomId, tgId, res.muteTargets, res.unmuteTarget)
    }

    return NextResponse.json({ session })
  }

  if (action === 'stop') {
    await supabase.from('game_sessions')
      .update({ phase: 'finished', updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'phase') {
    // Mafia day/night toggle
    const session = await getSession(roomId)
    if (!session || session.game_type !== 'mafia') {
      return NextResponse.json({ error: 'Not a mafia session' }, { status: 400 })
    }
    const phase = body.phase === 'day' ? 'day' : 'night'
    const state = { ...(session.state as Record<string, unknown>), phase }
    const { data: updated } = await supabase
      .from('game_sessions')
      .update({ state, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .select('*')
      .single()
    return NextResponse.json({ session: updated })
  }

  if (action === 'end_turn') {
    const session = await getSession(roomId)
    if (!session) return NextResponse.json({ error: 'No active game' }, { status: 400 })
    const gameType = session.game_type as string
    if (!isTurnGame(gameType)) {
      return NextResponse.json({ error: 'Game has no turns' }, { status: 400 })
    }
    const state = session.state as GameEngineState
    // Only the current speaker or the host may end the turn
    const order = (state as { order: number[] }).order
    const turnIndex = (state as { turn_index: number }).turn_index
    const speaker = order[turnIndex]
    if (!isHost && speaker !== tgId) {
      return NextResponse.json({ error: 'Сейчас не твой ход' }, { status: 403 })
    }
    const memberIds = await getMemberIds(roomId)
    const res = advanceTurn(gameType, state, memberIds)
    if (res.changed) {
      await supabase.from('game_sessions')
        .update({ state: res.state, updated_at: new Date().toISOString() })
        .eq('id', session.id)
      await broadcastMute(roomId, room.host_id, res.muteTargets, res.unmuteTarget)
    }
    const view = sanitizeState(gameType, res.state, tgId, true)
    return NextResponse.json({ session: { ...session, state: res.state }, view })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
