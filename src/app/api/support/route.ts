import { NextRequest, NextResponse } from 'next/server'
import { supabase, type SupportTicketRow } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/support — my tickets (newest first).
 * POST /api/support { type, subject, message } — create a ticket.
 *   type: 'bug' | 'idea' | 'question'
 */

const TICKET_TYPES = new Set(['bug', 'idea', 'question'])

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', parseInt(userId, 10))
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) {
    console.error('[support] GET error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ tickets: (data ?? []) as SupportTicketRow[] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)

  const body = await req.json().catch(() => ({}))
  const type = String(body.type ?? 'question')
  const subject = String(body.subject ?? '').trim()
  const message = String(body.message ?? '').trim()

  if (!TICKET_TYPES.has(type)) {
    return NextResponse.json({ error: 'Неверный тип обращения' }, { status: 400 })
  }
  if (subject.length < 3 || subject.length > 120) {
    return NextResponse.json({ error: 'Тема: от 3 до 120 символов' }, { status: 400 })
  }
  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json({ error: 'Сообщение: от 10 до 2000 символов' }, { status: 400 })
  }

  // Rate limit: max 5 open tickets per user
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', tgId)
    .in('status', ['new', 'in_progress'])

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Слишком много открытых обращений — дождись ответа' },
      { status: 429 }
    )
  }

  const { data: created, error: insErr } = await supabase
    .from('support_tickets')
    .insert({ user_id: tgId, type, subject, message })
    .select('*')
    .single()

  if (insErr) {
    console.error('[support] POST error:', insErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ticket: created }, { status: 201 })
}
