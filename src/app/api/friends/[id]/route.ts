import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/friends/[id]
 * Accept a friend request. Only the recipient (user_id_2) can accept.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const { id } = await params

  // Verify the requester is the recipient
  const { data: req_row } = await supabase
    .from('friends')
    .select('user_id_1, user_id_2, status')
    .eq('id', id)
    .maybeSingle()

  if (!req_row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  if (req_row.user_id_2 !== tgId) {
    return NextResponse.json({ error: 'Not your request to accept' }, { status: 403 })
  }

  if (req_row.status !== 'pending') {
    return NextResponse.json({ error: 'Already processed' }, { status: 400 })
  }

  const { error } = await supabase
    .from('friends')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/friends/[id]
 * Decline a request OR remove an existing friendship.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const { id } = await params

  // Verify ownership (must be either side of the friendship)
  const { data: row } = await supabase
    .from('friends')
    .select('user_id_1, user_id_2')
    .eq('id', id)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (row.user_id_1 !== tgId && row.user_id_2 !== tgId) {
    return NextResponse.json({ error: 'Not your friendship' }, { status: 403 })
  }

  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
