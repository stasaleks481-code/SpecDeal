/**
 * Spec Deal — landing page.
 *
 * The actual product is a Telegram bot; this page exists so that:
 *   1. The deployed Vercel URL serves something at `/` (health check).
 *   2. Visitors who land here know what the bot is and where to find it.
 *
 * The page itself is intentionally minimal — most styling investment goes
 * into the bot's text responses (Telegram messages).
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight">
            🏎️ SPEC DEAL
          </h1>
          <p className="text-sm text-zinc-400 uppercase tracking-widest">
            Telegram Auto Trader Simulator
          </p>
        </div>

        <p className="text-zinc-300 leading-relaxed">
          Покупай утиль, восстанавливай, тюнинговай, выбивай блатные номера
          и продавай с наваром — либо рви всех на дрэге за 402 метра.
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left space-y-2 text-sm">
          <div className="font-semibold text-zinc-100">Стек</div>
          <ul className="space-y-1 text-zinc-400">
            <li>
              <code className="text-emerald-400">Next.js 16</code> + TypeScript
            </li>
            <li>
              <code className="text-emerald-400">grammY</code> — Telegram bot framework
            </li>
            <li>
              <code className="text-emerald-400">Supabase</code> — Postgres + RLS
            </li>
            <li>
              <code className="text-emerald-400">Vercel</code> — webhook hosting
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left space-y-2 text-sm">
          <div className="font-semibold text-zinc-100">Endpoints</div>
          <ul className="space-y-1 text-zinc-400">
            <li>
              <code className="text-emerald-400">GET /</code> — this page
            </li>
            <li>
              <code className="text-emerald-400">GET /api/telegram</code> — health check
            </li>
            <li>
              <code className="text-emerald-400">POST /api/telegram</code> — webhook (Telegram only)
            </li>
          </ul>
        </div>

        <p className="text-xs text-zinc-500 pt-4">
          Сделано для Telegram. Найди бота в Telegram, нажми Start — и поехали. 🏁
        </p>
      </div>
    </main>
  )
}
