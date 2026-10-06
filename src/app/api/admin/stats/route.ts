import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'
import { isEffectivelyOnline } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/stats
 * Dashboard: KPIs, 14-day charts, recent signups.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const RANGE_DAYS = 14

type CreatedAt = { created_at: string }

function bucketByDay(rows: CreatedAt[]): { date: string; count: number }[] {
  const buckets: Record<string, number> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = RANGE_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS)
    buckets[d.toISOString().slice(0, 10)] = 0
  }
  for (const row of rows) {
    const key = row.created_at.slice(0, 10)
    if (key in buckets) buckets[key] += 1
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const now = Date.now()
  const h24 = new Date(now - DAY_MS).toISOString()
  const d7 = new Date(now - 7 * DAY_MS).toISOString()
  const range = new Date(now - RANGE_DAYS * DAY_MS).toISOString()

  // ── Counters (head queries — no payload) ──────────────────────────
  const count = async (table: string, extra?: (q: any) => any): Promise<number> => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true })
    if (extra) q = extra(q)
    const { count: c } = await q
    return c ?? 0
  }

  const [
    usersTotal,
    usersNew24h,
    usersNew7d,
    roomsActive,
    roomsTotal,
    msgs24h,
    reviewsTotal,
    ticketsNew,
    ticketsTotal,
    friendsTotal,
  ] = await Promise.all([
    count('users'),
    count('users', (q) => q.gte('created_at', h24)),
    count('users', (q) => q.gte('created_at', d7)),
    count('rooms', (q) => q.eq('is_active', true)),
    count('rooms'),
    count('room_messages', (q) => q.gte('created_at', h24)),
    count('reviews'),
    count('support_tickets', (q) => q.in('status', ['new', 'in_progress'])),
    count('support_tickets'),
    count('friends', (q) => q.eq('status', 'accepted')),
  ])

  // ── Online + account type breakdown ───────────────────────────────
  const { data: presence } = await supabase
    .from('users')
    .select('is_online, last_seen_at, account_type')
    .limit(20000)

  let onlineNow = 0
  let active24h = 0
  const byType: Record<string, number> = { anonymous: 0, telegram: 0, steam: 0 }
  for (const u of presence ?? []) {
    byType[u.account_type] = (byType[u.account_type] ?? 0) + 1
    if (new Date(u.last_seen_at).getTime() > now - DAY_MS) active24h += 1
    if (isEffectivelyOnline(u.is_online, u.last_seen_at)) onlineNow += 1
  }

  // ── Chart series (14 days) ────────────────────────────────────────
  const [{ data: signupRows }, { data: msgRows }, { data: roomRows }, { data: dmRows }] =
    await Promise.all([
      supabase.from('users').select('created_at').gte('created_at', range).limit(10000),
      supabase.from('room_messages').select('created_at').gte('created_at', range).limit(20000),
      supabase.from('rooms').select('created_at').gte('created_at', range).limit(10000),
      supabase.from('direct_messages').select('created_at').gte('created_at', range).limit(20000),
    ])

  // ── Recent signups ────────────────────────────────────────────────
  const { data: recentUsers } = await supabase
    .from('users')
    .select('id, username, first_name, photo_url, account_type, created_at')
    .order('created_at', { ascending: false })
    .limit(8)

  // ── Open tickets preview ──────────────────────────────────────────
  const { data: openTickets } = await supabase
    .from('support_tickets')
    .select('id, type, subject, status, created_at, user_id')
    .in('status', ['new', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    kpis: {
      users_total: usersTotal,
      users_online: onlineNow,
      users_active_24h: active24h,
      users_new_24h: usersNew24h,
      users_new_7d: usersNew7d,
      rooms_active: roomsActive,
      rooms_total: roomsTotal,
      msgs_24h: msgs24h,
      reviews_total: reviewsTotal,
      tickets_new: ticketsNew,
      tickets_total: ticketsTotal,
      friends_total: friendsTotal,
    },
    by_type: byType,
    charts: {
      signups: bucketByDay((signupRows ?? []) as CreatedAt[]),
      messages: bucketByDay((msgRows ?? []) as CreatedAt[]),
      dms: bucketByDay((dmRows ?? []) as CreatedAt[]),
      rooms: bucketByDay((roomRows ?? []) as CreatedAt[]),
    },
    recent_users: recentUsers ?? [],
    open_tickets: openTickets ?? [],
  })
}
