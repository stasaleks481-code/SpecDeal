import { supabase } from '@/lib/supabase/client'
import { questDef, questPeriod } from '@/lib/supabase/client'

/**
 * Server-side quest/currency engine.
 *
 * All bumps are fire-and-forget safe: a failing quest update must never
 * break the main API action, so callers may `await` without try/catch —
 * every function swallows errors internally after logging.
 */

/** Bump a daily quest for the user (clamped at target, idempotent per period). */
export async function bumpQuest(userId: number, code: string, delta = 1): Promise<void> {
  try {
    const def = questDef(code)
    if (!def || delta <= 0) return
    const period = questPeriod()
    const progress = Math.min(def.target, delta)

    // Upsert: create or grow (but never past target)
    const { data: existing } = await supabase
      .from('quest_progress')
      .select('progress, claimed')
      .eq('user_id', userId)
      .eq('quest_code', code)
      .eq('period', period)
      .maybeSingle()

    if (!existing) {
      await supabase
        .from('quest_progress')
        .insert({ user_id: userId, quest_code: code, period, progress })
      return
    }
    if (existing.claimed || existing.progress >= def.target) return
    const next = Math.min(def.target, existing.progress + delta)
    if (next !== existing.progress) {
      await supabase
        .from('quest_progress')
        .update({ progress: next, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('quest_code', code)
        .eq('period', period)
    }
  } catch (e) {
    console.error('[quests] bumpQuest failed:', code, e)
  }
}

/** Grant (or remove, with floor at 0) coins for a user. Returns new balance. */
export async function grantCoins(userId: number, delta: number): Promise<number | null> {
  try {
    if (!Number.isFinite(delta) || delta === 0) return null
    const { data } = await supabase
      .from('users')
      .select('coins')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return null
    const next = Math.max(0, (data.coins ?? 0) + Math.round(delta))
    await supabase
      .from('users')
      .update({ coins: next, updated_at: new Date().toISOString() })
      .eq('id', userId)
    return next
  } catch (e) {
    console.error('[quests] grantCoins failed:', e)
    return null
  }
}

/**
 * Count a finished voice session as a match:
 * increments the total and per-category counters, bumps the
 * 'voice_time' quest by spent minutes.
 */
export async function countVoiceMatch(
  userId: number,
  category: string | null | undefined,
  minutes: number
): Promise<void> {
  try {
    if (!Number.isFinite(minutes) || minutes < 3) return
    const mins = Math.min(240, Math.round(minutes))

    const { data } = await supabase
      .from('users')
      .select('matches_count, casual_matches, party_matches, pc_matches')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return

    const patch: Record<string, number> = {
      matches_count: (data.matches_count ?? 0) + 1,
      casual_matches: data.casual_matches ?? 0,
      party_matches: data.party_matches ?? 0,
      pc_matches: data.pc_matches ?? 0,
    }
    if (category === 'party') patch.party_matches += 1
    else if (category === 'game') patch.pc_matches += 1
    else patch.casual_matches += 1

    await supabase.from('users').update(patch).eq('id', userId)
    await bumpQuest(userId, 'voice_time', mins)
  } catch (e) {
    console.error('[quests] countVoiceMatch failed:', e)
  }
}
