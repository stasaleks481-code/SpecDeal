import type { InlineKeyboardMarkup } from 'grammy'

/**
 * Main menu — shown on /start and via "🏠 Главное меню" button.
 *
 * Layout matches the spec:
 *   🚗 Мой Гараж   |  🔍 Поиск Авто
 *   🔧 Мастерская  |  🎲 Авторынок
 *   🏦 Банк        |  🏁 Гонки
 *   📦 Кейсы       |  👤 Профиль
 */
export function buildMainMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🚗 Мой Гараж', callback_data: 'garage:view' },
        { text: '🔍 Поиск Авто', callback_data: 'search:open' },
      ],
      [
        { text: '🔧 Мастерская', callback_data: 'workshop:open' },
        { text: '🎲 Авторынок', callback_data: 'market:open' },
      ],
      [
        { text: '🏦 Банк и Бизнес', callback_data: 'bank:open' },
        { text: '🏁 Гонки', callback_data: 'races:open' },
      ],
      [
        { text: '📦 Кейсы', callback_data: 'cases:open' },
        { text: '👤 Профиль', callback_data: 'profile:view' },
      ],
    ],
  }
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
      'Ты — перекуп и механик в одном лице. Покупай утиль, восстанавливай, ',
      'тюнь, выбивай блатные номера и продавай с наваром — либо рви всех ',
      'на дрэге за 402 метра.',
      '',
      '💰 Стартовый баланс: <b>$50,000 CR</b>',
      '🚗 Слотов в гараже: <b>3</b>',
      '',
      '👇 Выбирай раздел, чтобы начать:',
    ].join('\n')
  }

  return [
    header,
    '',
    `👋 С возвращением, <b>${escapeHtml(firstName)}</b>!`,
    '',
    'Гараж ждёт. Что делаем?',
    '',
    '👇 Выбирай раздел:',
  ].join('\n')
}

/** Generic "section under construction" message. */
export function underConstruction(sectionName: string): string {
  return [
    '━━━━━━ 🚧 В РАЗРАБОТКЕ ━━━━━━',
    '',
    `Раздел <b>${escapeHtml(sectionName)}</b> ещё не открыт.`,
    '',
    'Сейчас работает: <code>/start</code>, главное меню и профиль игрока.',
    '',
    '👇 Возвращайся в меню:',
  ].join('\n')
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
