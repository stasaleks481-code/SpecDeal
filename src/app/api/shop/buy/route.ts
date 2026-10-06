import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { SHOP_ITEMS, type CosmeticKind } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS: CosmeticKind[] = ['frame', 'name_style', 'title']

/**
 * POST /api/shop/buy { kind, code } — purchase a cosmetic item.
 * Optimistic-lock purchase: read balance, guarded update
 * (coins >= price AND coins unchanged since read), then inventory insert.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const tgId = parseInt(userId, 10)

  const body = await req.json().catch(() => ({}))
  const kind = String(body.kind ?? '') as CosmeticKind
  const code = String(body.code ?? '')
  if (!KINDS.includes(kind) || !code) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
  }

  // Catalog lookup (static definition of price)
  const def = SHOP_ITEMS.find((i) => i.kind === kind && i.code === code)
  if (!def) {
    return NextResponse.json({ error: 'Unknown item' }, { status: 404 })
  }

  // Ownership check
  const { data: owned } = await supabase
    .from('inventory')
    .select('id')
    .eq('user_id', tgId)
    .eq('kind', kind)
    .eq('code', code)
    .maybeSingle()
  if (owned) {
    return NextResponse.json({ error: 'Already owned' }, { status: 409 })
  }

  // Read balance
  const { data: user } = await supabase
    .from('users')
    .select('coins')
    .eq('id', tgId)
    .maybeSingle()
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const balance = user.coins ?? 0
  if (balance < def.price) {
    return NextResponse.json({ error: 'Not enough coins' }, { status: 402 })
  }

  // Optimistic-lock decrement: succeeds only if coins still equals `balance`
  const { data: charged, error: chargeErr } = await supabase
    .from('users')
    .update({ coins: balance - def.price, updated_at: new Date().toISOString() })
    .eq('id', tgId)
    .eq('coins', balance)
    .select('coins')
    .maybeSingle()

  if (chargeErr || !charged) {
    return NextResponse.json({ error: 'Balance changed, try again' }, { status: 409 })
  }

  const { error: invErr } = await supabase
    .from('inventory')
    .insert({ user_id: tgId, kind, code })

  if (invErr) {
    // Refund best-effort if the inventory insert failed
    await supabase
      .from('users')
      .update({ coins: charged.coins + def.price })
      .eq('id', tgId)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, coins: charged.coins })
}
