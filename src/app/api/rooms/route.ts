import { NextRequest, NextResponse } from 'next/server'
import { supabase, GAMES, CASUAL_TOPICS, PARTY_GAMES, SKILL_LEVELS, type RoomRow, type UserRow, type SkillLevel } from '@/lib/supabase/client'
import { getUserAllowedForAction, ANON_ERROR } from '@/lib/server/auth-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms?category=game|casual|party&game=cs2&format=5x5&style=chill&skill=mid&game_type=bunker&q=...
 *
 * Returns active rooms filtered by category/game/format/style/skill/game_type/search.
 * Also lazily closes GHOST rooms (no members for > 10 minutes).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const category = url.searchParams.get('category') as 'game' | 'casual' | 'party' | null
  const game = url.searchParams.get('game')
  const format = url.searchParams.get('format')
  const style = url.searchParams.get('style')
  const skill = url.searchParams.get('skill')
  const gameType = url.searchParams.get('game_type')
  const q = url.searchParams.get('q')?.trim()

  // ── Ghost room cleanup (lazy, fires with any list refresh) ──────
  // Close rooms with zero members older than 10 minutes.
  void (async () => {
    try {
      const { data: stale } = await supabase
        .from('rooms')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('is_active', true)
        .is('closed_at', null)
        .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .select('id')
      // Only close those that actually have no members left
      const staleRooms = (stale ?? []) as { id: string }[]
      for (const r of staleRooms) {
        const { count } = await supabase
          .from('room_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('room_id', r.id)
        if (count === 0) {
          await supabase.from('rooms').update({ is_active: false, closed_at: new Date().toISOString() }).eq('id', r.id)
        } else {
          // Had members after all — reopen
          await supabase.from('rooms').update({ is_active: true, closed_at: null }).eq('id', r.id)
        }
      }
    } catch {
      // cleanup is best-effort
    }
  })()

  let query = supabase
    .from('rooms')
    .select(`
      *,
      host:users!rooms_host_id_fkey(id, username, first_name, last_name, photo_url),
      members:room_members(user_id)
    `)
    .eq('is_active', true)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (category) query = query.eq('category', category)
  if (game && category === 'game') query = query.eq('game_name', game)
  if (format) query = query.eq('game_format', format)
  if (style) query = query.eq('play_style', style)
  if (skill && category === 'game') query = query.eq('skill_level', skill)
  if (gameType && category === 'party') query = query.eq('game_type', gameType)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error } = await query

  if (error) {
    console.error('[rooms] GET error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Transform: flatten member count
  const rooms = (data ?? []).map((r: RoomRow & { members?: { user_id: number }[]; host?: Record<string, unknown> }) => ({
    ...r,
    member_count: r.members?.length ?? 0,
    members: undefined, // strip the array, just keep count
  }))

  return NextResponse.json({ rooms })
}

/**
 * POST /api/rooms
 * Body: { category, game_name?, game_format?, play_style?, topic_tags?, title?, max_players }
 *
 * Creates a new room. Host is auto-added as first member.
 * Title is OPTIONAL — if empty, a friendly default is generated.
 * Anonymous accounts cannot create rooms.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  if (isNaN(tgId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  // Anonymous accounts cannot create rooms
  const host: UserRow | null = await getUserAllowedForAction(tgId, 'create_room')
  if (!host) {
    const user = await supabase.from('users').select('account_type').eq('id', tgId).maybeSingle()
    if ((user.data as { account_type?: string } | null)?.account_type === 'anonymous') {
      return NextResponse.json({ error: ANON_ERROR, error_code: 'ACCOUNT_REQUIRED' }, { status: 403 })
    }
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  // Validate category: game (PC LFG) | casual | party (table games)
  const category = body.category as 'game' | 'casual' | 'party'
  if (category !== 'game' && category !== 'casual' && category !== 'party') {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  // Validate title — OPTIONAL: auto-generate when empty
  let title = (body.title as string)?.trim() ?? ''
  if (title) {
    if (title.length < 1 || title.length > 50) {
      return NextResponse.json({ error: 'Title must be 1-50 chars' }, { status: 400 })
    }
  } else {
    // Friendly auto-title based on category and host
    title = category === 'game'
      ? `Лобби ${host.first_name}`
      : category === 'party'
      ? `Парти ${host.first_name}`
      : `Комната ${host.first_name}`
  }

  // Validate max_players — party rooms support bigger tables (2-12)
  const maxPlayersLimit = category === 'party' ? 12 : 5
  const maxPlayersMin = category === 'party' ? 3 : 2
  const maxPlayers = parseInt(body.max_players, 10)
  if (isNaN(maxPlayers) || maxPlayers < maxPlayersMin || maxPlayers > maxPlayersLimit) {
    return NextResponse.json(
      { error: `max_players must be ${maxPlayersMin}-${maxPlayersLimit}` },
      { status: 400 }
    )
  }

  // Category-specific validation
  let gameName: string | null = null
  let gameFormat: string | null = null
  let playStyle: string | null = null
  let skillLevel: SkillLevel | null = null
  let gameType: string | null = null
  let gameSettings: Record<string, unknown> | null = null
  let topicTags: string[] = []

  if (category === 'game') {
    gameName = body.game_name ?? 'cs2'
    if (!GAMES.find((g) => g.code === gameName)) {
      return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
    }
    gameFormat = body.game_format ?? '5x5'
    playStyle = body.play_style ?? 'chill'
    // Skill level (Casual / Mid / Hardcore)
    const sl = body.skill_level as SkillLevel | undefined
    if (sl && !(sl in SKILL_LEVELS)) {
      return NextResponse.json({ error: 'Invalid skill level' }, { status: 400 })
    }
    skillLevel = sl ?? null
  } else if (category === 'party') {
    // Party game type (spyfall / mafia / bunker / whoami)
    gameType = body.game_type as string
    if (!PARTY_GAMES.find((g) => g.code === gameType)) {
      return NextResponse.json({ error: 'Unknown party game' }, { status: 400 })
    }
    const def = PARTY_GAMES.find((g) => g.code === gameType)!
    if (maxPlayers < def.minPlayers) {
      return NextResponse.json(
        { error: `«${def.name}» требует минимум ${def.minPlayers} игроков` },
        { status: 400 }
      )
    }
    gameSettings = {
      auto_mute: body.auto_mute !== undefined ? Boolean(body.auto_mute) : true,
    }
  } else {
    // Topics removed from creation form — keep legacy tags only if supplied
    topicTags = Array.isArray(body.topic_tags)
      ? body.topic_tags.filter((t: string) => CASUAL_TOPICS.find((c) => c.code === t))
      : []
  }

  // Insert room
  // voice_enabled is always true — rooms are voice-first now
  // game_settings is NOT NULL DEFAULT in DB — omit when unset
  const insertPayload: Record<string, unknown> = {
    host_id: tgId,
    category,
    game_name: gameName,
    game_format: gameFormat,
    play_style: playStyle,
    skill_level: skillLevel,
    game_type: gameType,
    topic_tags: topicTags,
    title,
    max_players: maxPlayers,
    is_active: true,
    voice_enabled: true,
  }
  if (gameSettings) insertPayload.game_settings = gameSettings

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert(insertPayload)
    .select('*')
    .single<RoomRow>()

  if (roomErr || !room) {
    console.error('[rooms] insert error:', roomErr)
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
  }

  // Add host as first member
  const { error: memberErr } = await supabase
    .from('room_members')
    .insert({ room_id: room.id, user_id: tgId, is_ready: false })

  if (memberErr) {
    console.error('[rooms] member insert error:', memberErr)
  }

  return NextResponse.json({ room })
}
