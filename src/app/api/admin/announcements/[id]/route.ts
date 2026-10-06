import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH  /api/admin/announcements/[id] { is_active?, title?, body?, kind? }
 * DELETE /api/admin/announcements/[id]
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

  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  if (body.title !== undefined) {
    const t = String(body.title).trim()
    if (t.length < 3 || t.length > 120) {
      return NextResponse.json({ error: 'Заголовок: 3..120 символов' }, { status: 400 })
    }
    patch.title = t
  }
  if (body.body !== undefined) {
    const b = String(body.body).trim()
    if (b.length < 3 || b.length > 1000) {
      return NextResponse.json({ error: 'Текст: 3..1000 символов' }, { status: 400 })
    }
    patch.body = b
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase.from('announcements').update(patch).eq('id', id)
  if (error) {
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
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
