import 'server-only'
/**
 * Centralized env access — fails fast if anything is missing.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`[env] Missing required variable: ${name}`)
  }
  return value
}

export const env = {
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
} as const

export type Env = typeof env
