/**
 * Centralised env-var access with validation.
 * Throws at boot time if any required var is missing — fail loud, fail early.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
        `Check .env.local (dev) or Vercel Project Settings → Environment Variables (prod).`
    )
  }
  return value
}

export const env = {
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  /** Optional — used to verify Telegram webhook requests in production. */
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  /** Optional — base URL of the deployed app, e.g. https://specdeal.vercel.app */
  appBaseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL,
} as const

export type Env = typeof env
