import { Keyboard, InlineKeyboard } from 'grammy'

/**
 * Persistent Reply Keyboard — always visible at the bottom of chat.
 * Used only as quick navigation between sections.
 */
export function mainMenuKeyboard() {
  return new Keyboard()
    .text('🚗 Гараж').text('🏬 Салоны').row()
    .text('🔧 Сервис').text('🎰 Номера').row()
    .text('🏦 Банк').text('🏁 Гонки').row()
    .text('📦 Кейсы').text('👤 Профиль').row()
    .resized()
}

/**
 * Inline "back to section" button shown at the bottom of every sub-menu.
 */
export function backBtn(callback: string = 'menu:main') {
  return new InlineKeyboard().text('⬅️ Назад', callback)
}

/** Universal "cancel" inline button */
export function cancelBtn() {
  return new InlineKeyboard().text('❌ Отмена', 'cancel')
}

/** Welcome text — short and to the point */
export function welcomeText(firstName: string, isNew: boolean): string {
  if (isNew) {
    return [
      `👋 Привет, ${escapeHtml(firstName)}!`,
      '',
      'Ты — перекуп. Покупаешь утиль, восстанавливаешь,',
      'тюнинговать и продаёшь дороже. Или рвёшь всех на дрэге.',
      '',
      '💰 Старт: $50,000',
      '🚗 Слотов в гараже: 3',
      '',
      'Жми кнопку внизу 👇',
    ].join('\n')
  }
  return [
    `👋 С возвращением, ${escapeHtml(firstName)}!`,
    '',
    'Жми кнопку внизу 👇',
  ].join('\n')
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
