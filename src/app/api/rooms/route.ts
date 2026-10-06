import { NextRequest, NextResponse } from 'next/server'
import { supabase, GAMES, CASUAL_TOPICS, type RoomRow } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms?category=game|casual&game=cs2&format=5x5&style=chill&topic=talk&q=cs2+lobby
 *
 * Returns active rooms filtered by category/game/format/style/topic/search query.
 * Includes member count + host info.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const category = url.searchParams.get('category') as 'game' | 'casual' | null
  const game = url.searchParams.get('game')
  const format = url.searchParams.get('format')
  const style = url.searchParams.get('style')
  const topic = url.searchParams.get('topic')
  const q = url.searchParams.get('q')?.trim()

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
  if (topic && category === 'casual') query = query.contains('topic_tags', [topic])
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
 * Body: { category, game_name?, game_format?, play_style?, topic_tags?, title, max_players }
 *
 * Creates a new room. Host is auto-added as first member.
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

  const body = await req.json().catch(() => ({}))

  // Validate category
  const category = body.category as 'game' | 'casual'
  if (category !== 'game' && category !== 'casual') {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  // Validate title
  const title = (body.title as string)?.trim()
  if (!title || title.length < 3 || title.length > 50) {
    return NextResponse.json({ error: 'Title must be 3-50 chars' }, { status: 400 })
  }

  // Validate max_players
  const maxPlayers = parseInt(body.max_players, 10)
  if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 5) {
    return NextResponse.json({ error: 'max_players must be 2-5' }, { status: 400 })
  }

  // Category-specific validation
  let gameName: string | null = null
  let gameFormat: string | null = null
  let playStyle: string | null = null
  let topicTags: string[] = []

  if (category === 'game') {
    gameName = body.game_name ?? 'cs2'
    if (!GAMES.find((g) => g.code === gameName)) {
      return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
    }
    gameFormat = body.game_format ?? '5x5'
    playStyle = body.play_style ?? 'chill'
  } else {
    topicTags = Array.isArray(body.topic_tags) ? body.topic_tags : ['talk']
    topicTags = topicTags.filter((t) => CASUAL_TOPICS.find((c) => c.code === t))
    if (topicTags.length === 0) topicTags = ['talk']
  }

  // Insert room
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({
      host_id: tgId,
      category,
      game_name: gameName,
      game_format: gameFormat,
      play_style: playStyle,
      topic_tags: topicTags,
      title,
      max_players: maxPlayers,
      is_active: true,
      voice_enabled: false,
    })
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
