import { NextRequest, NextResponse } from 'next/server'
import { supabase, type UserRow } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/users/[id] { trust_score?, is_banned?, badges?, first_name?, username? }
 * DELETE /api/admin/users/[id] — hard delete (cascades to rooms/messages).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const id = parseInt((await params).id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.trust_score !== undefined) {
    const ts = Number(body.trust_score)
    if (isNaN(ts) || ts < -1000 || ts > 1000) {
      return NextResponse.json({ error: 'trust_score: -1000..1000' }, { status: 400 })
    }
    patch.trust_score = Math.round(ts)
  }
  if (body.is_banned !== undefined) {
    patch.is_banned = Boolean(body.is_banned)
    // Kicking a user online immediately when banned
    if (patch.is_banned) patch.is_online = false
  }
  if (body.badges !== undefined) {
    if (!Array.isArray(body.badges)) {
      return NextResponse.json({ error: 'badges must be an array' }, { status: 400 })
    }
    patch.badges = body.badges.map(String).slice(0, 20)
  }
  if (body.first_name !== undefined) {
    const fn = String(body.first_name).trim()
    if (fn.length < 1 || fn.length > 64) {
      return NextResponse.json({ error: 'first_name: 1..64' }, { status: 400 })
    }
    patch.first_name = fn
  }
  if (body.username !== undefined) {
    const un = String(body.username).trim().replace(/^@/, '')
    patch.username = un === '' ? null : un
  }

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select('id, username, first_name, trust_score, is_banned, badges')
    .maybeSingle()

  if (error || !data) {
    console.error('[admin/users] PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ user: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const id = parseInt((await params).id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  // Safety: refuse to delete Telegram-primary accounts by numeric id unless
  // ?confirm=<id> matches (double confirmation in UI).
  const url = new URL(req.url)
  if (url.searchParams.get('confirm') !== String(id)) {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
  }

  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) {
    console.error('[admin/users] DELETE error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
