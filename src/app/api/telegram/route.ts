import { NextRequest, NextResponse } from 'next/server'
import { bot, ensureBotReady } from '@/lib/bot'
import { env } from '@/config/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Telegram webhook endpoint.
 *
 * Telegram sends a POST request to this URL with an Update object in the body
 * every time a user interacts with the bot. grammY's `webhookCallback`
 * transforms that into a Response.
 *
 * Setup (run once after deploying):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/telegram"
 *
 * Or via the helper script: `bun run scripts/setup-webhook.ts`
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Optional secret-token check — if you set TELEGRAM_WEBHOOK_SECRET env var
  // and pass it as the `secret_token` param in setWebhook, Telegram will send
  // it back in the `X-Telegram-Bot-Api-Secret-Token` header for verification.
  if (env.telegramWebhookSecret) {
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (headerSecret !== env.telegramWebhookSecret) {
      console.warn('[telegram] webhook secret mismatch — rejecting')
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await req.json()
    console.log('[telegram] received update:', JSON.stringify(body).slice(0, 300))
    await ensureBotReady()
    console.log('[telegram] bot ready, dispatching update')
    await bot.handleUpdate(body)
    console.log('[telegram] update dispatched successfully')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join(' | ') : ''
    console.error('[telegram] webhook handler error:', errMsg)
    if (stack) console.error('[telegram] stack:', stack)
    // Return 200 anyway — Telegram retries aggressively on non-2xx and we
    // don't want to be flooded with duplicate updates for transient errors.
    return NextResponse.json({ ok: true, error: 'handled', detail: errMsg })
  }
}

/**
 * GET endpoint — useful for sanity-checking that the webhook is reachable
 * AND that env vars are loaded (helps diagnose Vercel env var propagation).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    name: 'Spec Deal Telegram Webhook',
    bot_id: env.telegramBotToken.split(':')[0],
    supabase_url: env.supabaseUrl,
    supabase_key_prefix: env.supabaseAnonKey.slice(0, 20) + '...',
    timestamp: new Date().toISOString(),
  })
}
