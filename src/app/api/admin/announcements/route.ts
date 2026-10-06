import { NextRequest, NextResponse } from 'next/server'
import { supabase, type AnnouncementRow } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/admin/announcements — all announcements.
 * POST /api/admin/announcements { title, body, kind } — create one.
 */
const KINDS = new Set(['info', 'warning', 'update'])

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ announcements: (data ?? []) as AnnouncementRow[] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? '').trim()
  const text = String(body.body ?? '').trim()
  const kind = String(body.kind ?? 'info')

  if (title.length < 3 || title.length > 120) {
    return NextResponse.json({ error: 'Заголовок: 3..120 символов' }, { status: 400 })
  }
  if (text.length < 3 || text.length > 1000) {
    return NextResponse.json({ error: 'Текст: 3..1000 символов' }, { status: 400 })
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert({ title, body: text, kind })
    .select('*')
    .single()

  if (error) {
    console.error('[admin/announcements] POST error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ announcement: data }, { status: 201 })
}
