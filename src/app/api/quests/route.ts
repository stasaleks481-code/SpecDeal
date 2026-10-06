import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { QUEST_DEFS, questPeriod } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/quests — today's quest list with progress + coin balance.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const period = questPeriod()

  const [{ data: user }, { data: progress }] = await Promise.all([
    supabase.from('users').select('coins').eq('id', tgId).maybeSingle(),
    supabase
      .from('quest_progress')
      .select('quest_code, progress, claimed')
      .eq('user_id', tgId)
      .eq('period', period),
  ])

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const byCode = new Map((progress ?? []).map((p) => [p.quest_code, p]))
  const quests = QUEST_DEFS.map((def) => {
    const p = byCode.get(def.code)
    return {
      ...def,
      progress: Math.min(def.target, p?.progress ?? 0),
      claimed: p?.claimed ?? false,
      ready: !p?.claimed && (p?.progress ?? 0) >= def.target,
    }
  })

  return NextResponse.json({ coins: user.coins ?? 0, quests, period })
}
