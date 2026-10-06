import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/dm
 * Returns current user's direct message conversations (most recent first).
 * For each conversation partner, includes last message preview + unread count.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)

  // Get all DMs involving me, with sender/receiver info
  const { data, error } = await supabase
    .from('direct_messages')
    .select(`
      id,
      sender_id,
      receiver_id,
      content,
      created_at,
      read_at,
      sender:users!direct_messages_sender_id_fkey(id, username, first_name, last_name, photo_url, is_online),
      receiver:users!direct_messages_receiver_id_fkey(id, username, first_name, last_name, photo_url, is_online)
    `)
    .or(`sender_id.eq.${tgId},receiver_id.eq.${tgId}`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[dm list] error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Group by conversation partner (the other user, not me)
  const conversationsMap = new Map<number, {
    partner: Record<string, unknown>
    last_message: { content: string; created_at: string; sent_by_me: boolean }
    unread_count: number
  }>()

  for (const msg of (data ?? []) as Record<string, unknown>[]) {
    const isSender = msg.sender_id === tgId
    const partnerId = isSender ? (msg.receiver_id as number) : (msg.sender_id as number)
    const partnerData = isSender ? msg.receiver : msg.sender
    if (!partnerData || typeof partnerData !== 'object') continue

    const existing = conversationsMap.get(partnerId)
    if (!existing) {
      conversationsMap.set(partnerId, {
        partner: partnerData as Record<string, unknown>,
        last_message: {
          content: msg.content as string,
          created_at: msg.created_at as string,
          sent_by_me: isSender,
        },
        unread_count: (!isSender && !msg.read_at) ? 1 : 0,
      })
    } else if (!isSender && !msg.read_at) {
      existing.unread_count += 1
    }
  }

  const conversations = Array.from(conversationsMap.values()).sort(
    (a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
  )

  return NextResponse.json({ conversations })
}
