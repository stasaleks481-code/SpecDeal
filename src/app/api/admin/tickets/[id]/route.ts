import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/tickets/[id] { status?, admin_reply? }
 * Change ticket status and/or attach the admin's reply.
 */
const STATUSES = new Set(['new', 'in_progress', 'resolved'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const id = (await params).id
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    patch.status = status
  }
  if (body.admin_reply !== undefined) {
    const reply = String(body.admin_reply).trim()
    if (reply.length > 2000) {
      return NextResponse.json({ error: 'Reply too long (max 2000)' }, { status: 400 })
    }
    patch.admin_reply = reply === '' ? null : reply
    // Answering a ticket implicitly marks it resolved unless another status given
    if (body.status === undefined && reply !== '') patch.status = 'resolved'
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error || !data) {
    console.error('[admin/tickets] PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ticket: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const id = (await params).id
  const { error } = await supabase.from('support_tickets').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
