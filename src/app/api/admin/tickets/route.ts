import { NextRequest, NextResponse } from 'next/server'
import { supabase, type SupportTicketRow } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/tickets?status=&type=
 * Support tickets with user info.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const type = url.searchParams.get('type')

  let query = supabase
    .from('support_tickets')
    .select(`
      *,
      user:users!support_tickets_user_id_fkey(id, username, first_name, photo_url, account_type)
    `)
    .order('created_at', { ascending: false })
    .limit(60)

  if (status && status !== 'all') query = query.eq('status', status)
  if (type && type !== 'all') query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    console.error('[admin/tickets] error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ tickets: (data ?? []) as (SupportTicketRow & { user: Record<string, unknown> | null })[] })
}
