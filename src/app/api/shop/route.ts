import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/shop — catalog is static (client.ts), this returns the
 * dynamic half: coin balance + owned items + equipped codes.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const [{ data: user }, { data: inventory }] = await Promise.all([
    supabase.from('users').select('coins, avatar_frame, name_style, user_title').eq('id', tgId).maybeSingle(),
    supabase.from('inventory').select('*').eq('user_id', tgId),
  ])

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    coins: user.coins ?? 0,
    equipped: {
      frame: user.avatar_frame ?? null,
      name_style: user.name_style ?? null,
      title: user.user_title ?? null,
    },
    owned: inventory ?? [],
  })
}
