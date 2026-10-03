import { Keyboard, InlineKeyboard } from 'grammy'

/**
 * Persistent Reply Keyboard — fixed at the bottom of the chat,
 * always visible to the player (replaces the inline buttons that
 * disappeared after each message).
 *
 * Layout (4 rows × 2 cols):
 *   🚗 Гараж        |  🏬 Автосалоны
 *   🔧 Мастерская   |  🎰 Номера
 *   🏦 Банк         |  🏁 Гонки
 *   📦 Кейсы        |  👤 Профиль
 *
 * On mobile this fits the keyboard width nicely. Pressing any button
 * sends the same text as the label — bot matches it via bot.hears().
 */
export function mainMenuKeyboard() {
  return new Keyboard()
    .text('🚗 Гараж').text('🏬 Автосалоны').row()
    .text('🔧 Мастерская').text('🎰 Номера').row()
    .text('🏦 Банк').text('🏁 Гонки').row()
    .text('📦 Кейсы').text('👤 Профиль').row()
    .resized()
}

/**
 * "Confirm / Cancel" pattern used for purchases, sales, risky actions.
 */
export function confirmCancelInline(confirmLabel = '✅ Подтвердить') {
  return new InlineKeyboard()
    .text(confirmLabel, 'confirm:yes')
    .text('❌ Отмена', 'confirm:no')
}

/** Welcome text shown to first-time and returning players. */
export function welcomeText(firstName: string, isNew: boolean): string {
  const header = '━━━━━━ 🏎 SPEC DEAL ━━━━━━'

  if (isNew) {
    return [
      header,
      '',
      `👋 Привет, <b>${escapeHtml(firstName)}</b>!`,
      '',
      'Ты — перекуп и механик в одном лице.',
      'Покупай утиль, восстанавливай, тюнинговай, выбивай блатные номера',
      'и продавай с наваром — либо рви всех на дрэге за 402 метра.',
      '',
      '💰 Стартовый баланс: <b>$50,000 CR</b>',
      '🚗 Слотов в гараже: <b>3</b>',
      '',
      '👇 Меню внизу экрана — жми любую кнопку:',
    ].join('\n')
  }

  return [
    header,
    '',
    `👋 С возвращением, <b>${escapeHtml(firstName)}</b>!`,
    '',
    '👇 Меню внизу — выбирай раздел:',
  ].join('\n')
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
