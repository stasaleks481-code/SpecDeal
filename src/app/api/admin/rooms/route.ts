import { NextRequest, NextResponse } from 'next/server'
import { supabase, isEffectivelyOnline } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/rooms?active=1
 * Room list with host info + member counts.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const url = new URL(req.url)
  const onlyActive = url.searchParams.get('active') === '1'

  let query = supabase
    .from('rooms')
    .select(`
      id, title, category, game_name, game_type, skill_level,
      max_players, is_active, is_private, created_at, closed_at,
      host:users!rooms_host_id_fkey(id, username, first_name, photo_url, is_online, last_seen_at),
      room_members(count)
    `)
    .order('created_at', { ascending: false })
    .limit(60)

  if (onlyActive) query = query.eq('is_active', true)

  const { data, error } = await query

  if (error) {
    console.error('[admin/rooms] error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const rooms = (data ?? []).map((r: Record<string, unknown>) => {
    const host = r.host as Record<string, unknown> | null
    return {
      ...r,
      member_count: Array.isArray(r.room_members) ? (r.room_members[0] as { count?: number })?.count ?? 0 : 0,
      room_members: undefined,
      host: host
        ? { ...host, is_online: isEffectivelyOnline(host.is_online as boolean, host.last_seen_at as string) }
        : null,
    }
  })

  return NextResponse.json({ rooms })
}
