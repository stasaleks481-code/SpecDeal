#!/usr/bin/env bun
/**
 * Sets the Telegram webhook to point at the deployed Vercel URL.
 *
 * Usage:
 *   WEBHOOK_URL=https://specdeal.vercel.app bun run scripts/setup-webhook.ts
 *
 * Or pass URL as the first arg:
 *   bun run scripts/setup-webhook.ts https://specdeal.vercel.app
 *
 * After running this, Telegram will POST updates to <URL>/api/telegram.
 */

import { env } from '@/config/env'

const webhookUrl = process.argv[2] ?? process.env.WEBHOOK_URL

if (!webhookUrl) {
  console.error(
    '❌ Usage: bun run scripts/setup-webhook.ts https://your-app.vercel.app'
  )
  process.exit(1)
}

const fullUrl = `${webhookUrl.replace(/\/$/, '')}/api/telegram`
const botId = env.telegramBotToken.split(':')[0]

console.log(`\n📡 Setting Telegram webhook...`)
console.log(`   Bot ID: ${botId}`)
console.log(`   URL:    ${fullUrl}\n`)

const setUrl = `https://api.telegram.org/bot${env.telegramBotToken}/setWebhook`
const res = await fetch(setUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: fullUrl,
    drop_pending_updates: true,
    allowed_updates: [
      'message',
      'callback_query',
      'edited_message',
    ],
  }),
})

const data = await res.json()

if (data.ok) {
  console.log(`✅ Webhook set successfully.`)
  console.log(`   Telegram response: ${data.description}\n`)

  // Verify by calling getWebhookInfo
  const infoRes = await fetch(
    `https://api.telegram.org/bot${env.telegramBotToken}/getWebhookInfo`
  )
  const info = await infoRes.json()
  if (info.ok) {
    console.log(`📋 Webhook info:`)
    console.log(`   URL:                  ${info.result.url}`)
    console.log(`   Pending updates:      ${info.result.pending_update_count}`)
    console.log(`   Max connections:      ${info.result.max_connections}`)
    if (info.result.last_error_message) {
      console.log(`   ⚠️ Last error:        ${info.result.last_error_message}`)
    }
  }
} else {
  console.error(`❌ Failed to set webhook:`, data)
  process.exit(1)
}
