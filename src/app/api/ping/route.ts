import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/ping
 * Heartbeat — updates user's is_online=true + last_seen_at.
 * Client should call this every 30-60 seconds while app is open.
 *
 * On close/unmount, client should call /api/offline to set is_online=false.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('users')
    .update({
      is_online: true,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', parseInt(userId, 10))

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
