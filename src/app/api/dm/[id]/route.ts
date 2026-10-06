import { NextRequest, NextResponse } from 'next/server'
import { supabase, isEffectivelyOnline } from '@/lib/supabase/client'
import { bumpQuest } from '@/lib/server/quests'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/dm/[id]?limit=50&before=<iso>
 * Returns DM history between me and user [id]. Marks unread as read.
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
  const partnerId = parseInt((await params).id, 10)
  if (isNaN(partnerId)) {
    return NextResponse.json({ error: 'Invalid partner id' }, { status: 400 })
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)
  const before = url.searchParams.get('before')

  let query = supabase
    .from('direct_messages')
    .select(`
      id,
      sender_id,
      receiver_id,
      content,
      created_at,
      read_at
    `)
    .or(`and(sender_id.eq.${tgId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${tgId})`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Mark messages from partner to me as read
  await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', partnerId)
    .eq('receiver_id', tgId)
    .is('read_at', null)

  // Also fetch partner info for the header
  const { data: partner } = await supabase
    .from('users')
    .select('id, username, first_name, last_name, photo_url, is_online, last_seen_at')
    .eq('id', partnerId)
    .maybeSingle()

  // Effective online = flag + fresh heartbeat (fixes "stuck online")
  const partnerFixed = partner
    ? { ...partner, is_online: isEffectivelyOnline(partner.is_online, partner.last_seen_at) }
    : partner

  return NextResponse.json({
    messages: (data ?? []).reverse(),
    partner: partnerFixed,
  })
}

/**
 * POST /api/dm/[id]
 * Body: { content: string }
 * Sends a DM to user [id].
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
  const partnerId = parseInt((await params).id, 10)
  if (isNaN(partnerId) || partnerId === tgId) {
    return NextResponse.json({ error: 'Invalid partner' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const content = (body.content as string)?.trim()
  if (!content) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Message too long (max 1000)' }, { status: 400 })
  }

  // Verify partner exists
  const { data: partner } = await supabase
    .from('users')
    .select('id')
    .eq('id', partnerId)
    .maybeSingle()

  if (!partner) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: tgId,
      receiver_id: partnerId,
      content,
    })
    .select('id, sender_id, receiver_id, content, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Daily quest: message sent
  void bumpQuest(tgId, 'messages')

  return NextResponse.json({ message: data })
}
