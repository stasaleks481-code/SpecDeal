import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { shopItem, type CosmeticKind } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS: CosmeticKind[] = ['frame', 'name_style', 'title']
/** users column per cosmetic kind */
const COLUMN: Record<CosmeticKind, 'avatar_frame' | 'name_style' | 'user_title'> = {
  frame: 'avatar_frame',
  name_style: 'name_style',
  title: 'user_title',
}

/**
 * POST /api/shop/equip { kind, code|null } — equip or unequip (null) an
 * owned cosmetic. Unequip is always allowed; equip requires ownership.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const tgId = parseInt(userId, 10)

  const body = await req.json().catch(() => ({}))
  const kind = String(body.kind ?? '') as CosmeticKind
  const code = body.code === null ? null : String(body.code ?? '')
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }
  if (code !== null && !shopItem(kind, code)) {
    return NextResponse.json({ error: 'Unknown item' }, { status: 404 })
  }

  if (code !== null) {
    const { data: owned } = await supabase
      .from('inventory')
      .select('id')
      .eq('user_id', tgId)
      .eq('kind', kind)
      .eq('code', code)
      .maybeSingle()
    if (!owned) {
      return NextResponse.json({ error: 'Item not owned' }, { status: 403 })
    }
  }

  const patch: Record<string, string | null> = {
    [COLUMN[kind]]: code,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('users').update(patch).eq('id', tgId)
  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, equipped: code })
}
