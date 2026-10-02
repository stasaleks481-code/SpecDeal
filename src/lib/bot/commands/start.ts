import type { Context } from 'grammy'
import { supabase, NEW_USER_DEFAULTS, type UserRow } from '@/lib/supabase'
import { buildMainMenu, welcomeText, escapeHtml } from '@/lib/bot/menus/main'

/**
 * /start command handler.
 *
 * - If the player doesn't exist in DB → create a profile with starting balance.
 * - Always reply with the main menu inline keyboard.
 *
 * Telegram passes an optional deep-link payload after /start (e.g. `/start ref_123`)
 * — captured in `ctx.startPayload` for future referral / promo logic.
 */
export async function handleStart(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.reply('⚠️ Не удалось определить пользователя. Попробуй ещё раз.')
    return
  }

  const tg = ctx.from
  const firstName = tg.first_name ?? 'Игрок'
  const startPayload = ctx.startPayload // unused for now — reserved for referrals

  // Look up existing user
  let { data: user, error: lookupErr } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', tg.id)
    .maybeSingle<UserRow>()

  if (lookupErr) {
    console.error('[start] lookup error:', lookupErr)
    await ctx.reply('⚠️ Ошибка базы данных. Попробуй через минуту.')
    return
  }

  let isNew = false

  if (!user) {
    // Create new profile
    const insertPayload = {
      telegram_id: tg.id,
      username: tg.username ?? null,
      first_name: tg.first_name ?? null,
      last_name: tg.last_name ?? null,
      language_code: tg.language_code ?? null,
      ...NEW_USER_DEFAULTS,
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('users')
      .insert(insertPayload)
      .select('*')
      .single<UserRow>()

    if (insertErr || !inserted) {
      console.error('[start] insert error:', insertErr)
      await ctx.reply('⚠️ Не удалось создать профиль. Попробуй ещё раз.')
      return
    }

    user = inserted
    isNew = true
    console.log(`[start] new user created: tg_id=${tg.id} username=${tg.username ?? '-'}`)
  } else {
    // Update last-seen + username (Telegram username can change)
    await supabase
      .from('users')
      .update({
        username: tg.username ?? null,
        first_name: tg.first_name ?? null,
        last_name: tg.last_name ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_id', tg.id)
  }

  await ctx.reply(welcomeText(firstName, isNew), {
    parse_mode: 'HTML',
    reply_markup: buildMainMenu(),
    disable_web_page_preview: true,
  })
}
