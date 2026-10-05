import { NextRequest, NextResponse } from 'next/server'
import { supabase, type UserRow } from '@/lib/supabase/client'
import { validateInitData } from '@/lib/telegram/initdata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth
 * Body: { initData: string }
 *
 * Validates Telegram initData and creates/fetches user in Supabase.
 * Returns the user row (with badges, trust_score, theme, etc).
 *
 * For local development where initData isn't available (browser preview),
 * falls back to a dev user with id=777000777.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}))
    const initData: string = body.initData ?? ''

    let telegramId: number
    let firstName: string
    let lastName: string | null = null
    let username: string | null = null
    let photoUrl: string | null = null
    let languageCode: string | null = null

    if (initData) {
      // Production / real Telegram WebApp
      const validated = validateInitData(initData)
      telegramId = validated.user.id
      firstName = validated.user.first_name
      lastName = validated.user.last_name ?? null
      username = validated.user.username ?? null
      photoUrl = validated.user.photo_url ?? null
      languageCode = validated.user.language_code ?? null
    } else {
      // Dev fallback (no Telegram context)
      if (process.env.NODE_ENV !== 'production') {
        telegramId = 777000777
        firstName = 'DevPlayer'
        username = 'devplayer'
      } else {
        return NextResponse.json(
          { error: 'initData required in production' },
          { status: 400 }
        )
      }
    }

    // Look up existing user
    const { data: existing, error: lookupErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', telegramId)
      .maybeSingle<UserRow>()

    if (lookupErr) {
      console.error('[auth] lookup error:', lookupErr)
      return NextResponse.json({ error: 'DB lookup failed' }, { status: 500 })
    }

    let user: UserRow

    if (existing) {
      // Update last-seen + Telegram fields (username/photo can change)
      const { data: updated, error: updErr } = await supabase
        .from('users')
        .update({
          username,
          first_name: firstName,
          last_name: lastName,
          photo_url: photoUrl,
          language_code: languageCode,
          is_online: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', telegramId)
        .select('*')
        .maybeSingle<UserRow>()

      if (updErr || !updated) {
        console.error('[auth] update error:', updErr)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }
      user = updated
    } else {
      // Create new user
      const { data: created, error: insErr } = await supabase
        .from('users')
        .insert({
          id: telegramId,
          username,
          first_name: firstName,
          last_name: lastName,
          photo_url: photoUrl,
          language_code: languageCode,
          is_online: true,
          theme_color: 'cyan',
        })
        .select('*')
        .maybeSingle<UserRow>()

      if (insErr || !created) {
        console.error('[auth] insert error:', insErr)
        return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
      }
      user = created
    }

    return NextResponse.json({ user }, {
      headers: {
        'Set-Cookie': `tg_uid=${telegramId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[auth] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
