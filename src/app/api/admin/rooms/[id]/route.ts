import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/rooms/[id] { is_active } — close / reopen a room.
 * DELETE /api/admin/rooms/[id] — hard delete.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const id = (await params).id
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (body.is_active !== undefined) {
    patch.is_active = Boolean(body.is_active)
    patch.closed_at = patch.is_active ? null : new Date().toISOString()
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase.from('rooms').update(patch).eq('id', id)
  if (error) {
    console.error('[admin/rooms] PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const id = (await params).id
  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) {
    console.error('[admin/rooms] DELETE error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
