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
    await ensureBotReady()
    await bot.handleUpdate(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    // grammY throws BotError when handlers call Telegram API methods that
    // fail (e.g. sendMessage to a user who hasn't /start'd the bot yet).
    // Telegram retries aggressively on non-2xx responses, so we always
    // return 200 — the error is logged for diagnostics.
    const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error('[telegram] webhook handler error:', errMsg)
    return NextResponse.json({ ok: true })
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
    timestamp: new Date().toISOString(),
  })
}
