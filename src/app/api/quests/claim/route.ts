import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { questDef, questPeriod } from '@/lib/supabase/client'
import { grantCoins } from '@/lib/server/quests'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/quests/claim { code } — claim a completed daily quest reward.
 * Server re-validates progress and the claimed flag.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const tgId = parseInt(userId, 10)

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '')
  const def = questDef(code)
  if (!def) {
    return NextResponse.json({ error: 'Unknown quest' }, { status: 400 })
  }

  const period = questPeriod()
  const { data: progress } = await supabase
    .from('quest_progress')
    .select('progress, claimed')
    .eq('user_id', tgId)
    .eq('quest_code', code)
    .eq('period', period)
    .maybeSingle()

  if (!progress || progress.progress < def.target) {
    return NextResponse.json({ error: 'Quest not completed yet' }, { status: 400 })
  }
  if (progress.claimed) {
    return NextResponse.json({ error: 'Already claimed' }, { status: 409 })
  }

  const { error: updErr } = await supabase
    .from('quest_progress')
    .update({ claimed: true, updated_at: new Date().toISOString() })
    .eq('user_id', tgId)
    .eq('quest_code', code)
    .eq('period', period)
    .eq('claimed', false) // guard against double-claim race

  if (updErr) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const coins = await grantCoins(tgId, def.reward)
  return NextResponse.json({ ok: true, reward: def.reward, coins })
}
