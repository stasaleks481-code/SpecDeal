import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/config/env'

/**
 * VoiceDeck — party games engine (server-authoritative).
 *
 * Games: spyfall | mafia | bunker | whoami
 *
 * State is stored as one jsonb blob per room (game_sessions.state).
 * PRIVATE data (roles, own cards) is sanitized per-user in the API layer:
 * each client receives only what it is allowed to see.
 *
 * Turn-based games (bunker, whoami) carry a server timestamp turn_end;
 * any client may trigger "sync" and the server idempotently advances
 * expired turns. When a turn advances and auto_mute is enabled, the
 * server emits force-mute signals to everyone except the speaker.
 */

// ─────────────────────────────────────────────────────────────────────
// Decks
// ─────────────────────────────────────────────────────────────────────

const SPYFALL_LOCATIONS = [
  'Казино', 'Банк', 'Пляж', 'Космическая станция', 'Метро',
  'Больница', 'Отель', 'Театр', 'Военная база', 'Школа',
  'Цирк', 'Ресторан', 'Самолёт', 'Полицейский участок',
  'Пиратский корабль', 'Поезд', 'Супермаркет', 'Посольство',
  'Киностудия', 'Собор', 'Подводная лодка', 'Стадион',
  'Ночной клуб', 'Лыжный курорт',
]

const MAFIA_ROLES = {
  mafia: 'Мафия',
  sheriff: 'Шериф',
  doctor: 'Доктор',
  civilian: 'Мирный житель',
} as const

const CATASTROPHES = [
  { name: 'Ядерная зима', desc: 'Радиация накрыла 90% поверхности. На улице −40°C и пепел.' },
  { name: 'Пандемия «Чёрный кашель»', desc: 'Летальный вирус передаётся по воздуху, смертность 85%.' },
  { name: 'Восстание машин', desc: 'ИИ-дроны зачистили города. Выживших отслеживают с орбиты.' },
  { name: 'Великий потоп', desc: 'Уровень океана поднялся на 200 метров. Суши почти нет.' },
  { name: 'Падение астероида', desc: 'Астероид Ø15 км ударил по Атлантике. Идут кислотные дожди.' },
  { name: 'Нашествие', desc: 'Неизвестная форма жизни захватывает материки за недели.' },
  { name: 'Солнечная вспышка', desc: 'Вся электроника выжжена. Связи и энергосетей нет.' },
  { name: 'Извержение супервулкана', desc: 'Йеллоустоун взорвался. Небо закрыто пеплом на годы.' },
  { name: 'Магнитная буря', desc: 'Полярные шапки растаяли, компасы сошли с ума, экосистема рухнула.' },
  { name: 'Токсичный туман', desc: 'Из разломов земной коры поднимается ядовитый газ.' },
]

const BUNKERS = [
  { name: 'Военный бункер «Гранит»', desc: '5 отсеков, ОРУЖЕЙНАЯ, склад провизии на 2 года, медблок.' },
  { name: 'Научный комплекс «Сфера»', desc: 'Лаборатории, ГИДРОПОНИКА, генератор, библиотека.' },
  { name: 'Метро-убежище «Кольцо»', desc: 'Станция-ковчег: теплицы, скважина, мастерская.' },
  { name: 'Частный бункер миллиардера', desc: 'СПА-зона, кинозал, винный погреб, 8 кают.' },
  { name: 'Атомный ледокол «Ямал-9»', desc: 'Дрейфует в полярных водах: реактор на 50 лет, рыба у борта.' },
  { name: 'Заброшенная шахта «Глубина»', desc: '1200 м под землёй: подземное озеро, грибы, глухая тишина.' },
]

const PROFESSIONS = [
  'Хирург', 'Инженер-энергетик', 'Военный сапёр', 'Повар', 'Агроном',
  'Программист', 'Сантехник', 'Психолог', 'Ветеринар', 'Электрик',
  'Учитель', 'Швея', 'Охотник', 'Химик', 'Пожарный',
  'Механик', 'Акушер', 'Плотник', 'Радиоинженер', 'Стоматолог',
  'Фермер', 'Водолаз', 'Пилот', 'Сварщик', 'Ботаник', 'Сапожник',
]

const HEALTH = [
  'Абсолютно здоров', 'Близорукость (−5)', 'Астма', 'Аллергия на пыль',
  'Хромает на левую ногу', 'Слышит только правым ухом', 'Панические атаки',
  'Диабет (инсулин кончится)', 'Бессонница', 'Старая травма плеча',
  'Идеальное здоровье, но не умеет плавать', 'Сердечная аритмия',
  'Постоянный кашель', 'Здоров, но боится темноты',
]

const HOBBIES = [
  'Растит овощи на балконе', 'Реконструкция средневековых боёв', 'Разводит аквариумных рыб',
  'Йога и медитация', 'Игра на гитаре', 'Рукоделие и шитьё', 'Стрельба в тире',
  'Марафонский бег', 'Домашнее пивоварение', 'Коллекционирует ножи',
  '3D-печать', 'Пчеловодство', 'Рисует маслом', 'Азартные игры',
  'Кулинария', 'Подводное плавание', 'Радиолюбительство', 'Настольные RPG',
]

const PHOBIAS = [
  'Клаустрофобия (страх замкнутых пространств)', 'Гемофобия (страх крови)',
  'Никтофобия (страх темноты)', 'Арахнофобия (пауки)',
  'Аквафобия (страх воды)', 'Социофобия', 'Герпетофобия (рептилии)',
  'Акрофобия (страх высоты)', 'Мизофобия (страх микробов)',
  'Танатофобия (страх смерти)', 'Кинофобия (собаки)', 'Ситофобия (страх еды)',
]

const BAGGAGE = [
  'Аптечка и запас антибиотиков', 'Ружьё и 200 патронов', 'Набор инструментов',
  'Семена овощей и культур', 'Радиостанция дальнего действия', 'Спальный мешок и палатка',
  'Ящик тушёнки', 'Ноутбук с офлайн-Википедией', 'Швейцарский нож и верёвка',
  'Солярка в канистрах', 'Книги по медицине', 'Домашняя кошка в переноске',
  'Фильтр для воды', 'Солнечная батарея', 'Гитара', 'Спутниковый телефон (без сети)',
]

const FACTS = [
  'Отслужил 8 лет в спецназе', 'Пережил уже одну катастрофу', 'Умеет принимать роды',
  'Может спать 4 часа и быть бодрым', 'Знает 4 языка', 'Однажды выжил 20 дней в тайге',
  'Донор костного мозга', 'Чёрный пояс по дзюдо', 'Не ест мясо с детства',
  'Побывал в тюрьме за драку', 'Разбирается в генетике', 'Учился на священника',
  'Вегетарианец по убеждению', 'Страдает лунатизмом', 'Бесстрашно лезет в любую драку',
  'Ведёт канал про выживание с 100к подписчиков',
]

const WHOAMI_WORDS = [
  'Эйнштейн', 'Шерлок Холмс', 'Дарт Вейдер', 'Человек-паук', 'Бабушка',
  'Сантехник', 'Поп-звезда', 'Пират', 'Вампир', 'Космонавт',
  'Учитель физкультуры', 'Кот', 'Динозавр', 'Терминатор', 'Балерина',
  'Шеф-повар', 'Полицейский', 'Дракон', 'Фокусник', 'Футболист',
  'Мерлин Монро', 'Бэтмен', 'Дед Мороз', 'Зомби', 'Робот-пылесос',
  'Хакер', 'Илон Маск', 'Пикачу', 'Самурай', 'Викинг',
  'Доктор', 'Программист', 'Бариста', 'Ёлка', 'Айфон',
  'Банан', 'Метеорит', 'Акула', 'Пингвин', 'Бриллиант',
]

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export interface BunkerCards {
  profession: string
  health: string
  hobby: string
  phobia: string
  baggage: string
  fact: string
}

export interface SpyfallState {
  location: string
  spy_id: number
  order: number[]
}

export interface MafiaState {
  roles: Record<string, string>
  phase: 'night' | 'day'
}

export interface BunkerState {
  catastrophe: { name: string; desc: string }
  bunker: { name: string; desc: string }
  players: Record<string, BunkerCards>
  order: number[]
  turn_index: number
  turn_end: string | null
  auto_mute: boolean
}

export interface WhoAmIState {
  words: Record<string, string>
  order: number[]
  turn_index: number
  turn_end: string | null
  auto_mute: boolean
}

export type GameEngineState = SpyfallState | MafiaState | BunkerState | WhoAmIState

export function isTurnGame(gameType: string): boolean {
  return gameType === 'bunker' || gameType === 'whoami'
}

/** Deal initial state for a fresh game */
export function dealState(gameType: string, memberIds: number[], settings?: { auto_mute?: boolean }): GameEngineState {
  const autoMute = settings?.auto_mute !== false
  const order = shuffle(memberIds)

  switch (gameType) {
    case 'spyfall': {
      return {
        location: pick(SPYFALL_LOCATIONS),
        spy_id: pick(memberIds),
        order,
      }
    }
    case 'mafia': {
      const n = memberIds.length
      const mafiaCount = Math.max(1, Math.floor(n / 4))
      const hasSheriff = n >= 4
      const hasDoctor = n >= 6
      const roleBag: string[] = [
        ...Array(mafiaCount).fill('mafia'),
        ...(hasSheriff ? ['sheriff'] : []),
        ...(hasDoctor ? ['doctor'] : []),
        ...Array(Math.max(0, n - mafiaCount - (hasSheriff ? 1 : 0) - (hasDoctor ? 1 : 0))).fill('civilian'),
      ]
      const shuffledRoles = shuffle(roleBag)
      const roles: Record<string, string> = {}
      memberIds.forEach((uid, i) => {
        roles[String(uid)] = shuffledRoles[i] ?? 'civilian'
      })
      return { roles, phase: 'night' }
    }
    case 'bunker': {
      const players: Record<string, BunkerCards> = {}
      const prof = shuffle(PROFESSIONS)
      const hp = shuffle(HEALTH)
      const hb = shuffle(HOBBIES)
      const ph = shuffle(PHOBIAS)
      const bg = shuffle(BAGGAGE)
      const ft = shuffle(FACTS)
      order.forEach((uid, i) => {
        players[String(uid)] = {
          profession: prof[i % prof.length],
          health: hp[i % hp.length],
          hobby: hb[i % hb.length],
          phobia: ph[i % ph.length],
          baggage: bg[i % bg.length],
          fact: ft[i % ft.length],
        }
      })
      return {
        catastrophe: pick(CATASTROPHES),
        bunker: pick(BUNKERS),
        players,
        order,
        turn_index: 0,
        turn_end: new Date(Date.now() + 30_000).toISOString(),
        auto_mute: autoMute,
      }
    }
    case 'whoami': {
      const words = shuffle(WHOAMI_WORDS)
      const map: Record<string, string> = {}
      order.forEach((uid, i) => {
        map[String(uid)] = words[i % words.length]
      })
      return {
        words: map,
        order,
        turn_index: 0,
        turn_end: new Date(Date.now() + 60_000).toISOString(),
        auto_mute: autoMute,
      }
    }
    default:
      throw new Error(`Unknown game type: ${gameType}`)
  }
}

// ─────────────────────────────────────────────────────────────────────
// Per-user sanitization — the core of "private cards"
// ─────────────────────────────────────────────────────────────────────

export interface SanitizedView {
  [key: string]: unknown
}

export function sanitizeState(
  gameType: string,
  state: GameEngineState,
  userId: number,
  isHost: boolean
): SanitizedView {
  switch (gameType) {
    case 'spyfall': {
      const s = state as SpyfallState
      const isSpy = s.spy_id === userId
      return {
        game: 'spyfall',
        you_spy: isSpy,
        // Spy gets nothing; civilians get the shared location
        location: isSpy ? null : s.location,
        order: s.order,
      }
    }
    case 'mafia': {
      const s = state as MafiaState
      return {
        game: 'mafia',
        your_role: s.roles[String(userId)] ?? 'civilian',
        role_name: MAFIA_ROLES[(s.roles[String(userId)] ?? 'civilian') as keyof typeof MAFIA_ROLES] ?? 'Мирный житель',
        phase: s.phase,
        // Host leads the table — sees the full distribution to run day/night
        ...(isHost ? { host_view: s.roles, role_names: MAFIA_ROLES } : {}),
      }
    }
    case 'bunker': {
      const s = state as BunkerState
      const speaker = s.order[s.turn_index] ?? null
      return {
        game: 'bunker',
        catastrophe: s.catastrophe,
        bunker: s.bunker,
        your_cards: s.players[String(userId)] ?? null,
        order: s.order,
        turn_index: s.turn_index,
        speaker,
        turn_end: s.turn_end,
        auto_mute: s.auto_mute,
        // Host sees everyone's cards to arbitrate
        ...(isHost ? { host_view: s.players } : {}),
      }
    }
    case 'whoami': {
      const s = state as WhoAmIState
      const speaker = s.order[s.turn_index] ?? null
      // Everyone sees everyone's word EXCEPT their own (the card is "on their forehead")
      const visible: Record<string, string> = {}
      for (const [uid, word] of Object.entries(s.words)) {
        if (Number(uid) !== userId) visible[uid] = word
      }
      return {
        game: 'whoami',
        words: visible,
        order: s.order,
        turn_index: s.turn_index,
        speaker,
        turn_end: s.turn_end,
        auto_mute: s.auto_mute,
        your_word: s.words[String(userId)] ?? null, // never rendered to its owner
      }
    }
    default:
      return { game: gameType }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Turn engine (bunker / whoami) — idempotent auto-advance
// ─────────────────────────────────────────────────────────────────────

export interface TurnAdvanceResult {
  state: GameEngineState
  changed: boolean
  /** Member ids that must be force-muted (everyone except the speaker) */
  muteTargets: number[]
  /** Member id whose force-mute must be released (new speaker) */
  unmuteTarget: number | null
  speaker: number | null
}

export function advanceTurn(
  gameType: string,
  state: GameEngineState,
  liveMemberIds: number[],
  fromIndex?: number
): TurnAdvanceResult {
  const result: TurnAdvanceResult = { state, changed: false, muteTargets: [], unmuteTarget: null, speaker: null }
  if (!isTurnGame(gameType)) return result

  const seconds = gameType === 'bunker' ? 30 : 60
  const st = state as BunkerState & WhoAmIState

  // Keep only members who are still in the room
  const liveOrder = st.order.filter((uid) => liveMemberIds.includes(uid))
  if (liveOrder.length === 0) return result
  if (liveOrder.length !== st.order.length) st.order = liveOrder

  // Explicit index (initial deal) → use it; otherwise move to the NEXT speaker
  let idx: number
  if (fromIndex !== undefined) {
    idx = fromIndex % st.order.length
  } else {
    idx = (st.turn_index + 1) % st.order.length
  }

  st.turn_index = idx
  st.turn_end = new Date(Date.now() + seconds * 1000).toISOString()
  result.state = st
  result.changed = true
  result.speaker = st.order[idx] ?? null

  if (st.auto_mute) {
    result.unmuteTarget = result.speaker
    result.muteTargets = st.order.filter((uid) => uid !== result.speaker)
  }
  return result
}

/** Check whether the current turn has expired */
export function turnExpired(state: GameEngineState): boolean {
  if (!isTurnGameGame(state)) return false
  const st = state as BunkerState | WhoAmIState
  if (!st.turn_end) return true
  return new Date(st.turn_end).getTime() <= Date.now()
}

function isTurnGameGame(state: GameEngineState): boolean {
  return 'turn_end' in state && 'order' in state
}

// ─────────────────────────────────────────────────────────────────────
// Voice signaling TTL tokens (HMAC, derived from the bot token)
// ─────────────────────────────────────────────────────────────────────

const TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutes

function signalSecret(): string {
  return createHmac('sha256', env.telegramBotToken).update('voicedeck-signal-v1').digest('hex')
}

/** Issue a short-lived signaling token bound to (userId, roomId) */
export function issueVoiceToken(userId: number, roomId: string): { token: string; exp: number } {
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = `${userId}.${roomId}.${exp}`
  const sig = createHmac('sha256', signalSecret()).update(payload).digest('base64url')
  return { token: `${exp}.${sig}`, exp }
}

/** Verify a signaling token. Returns error string or null when valid. */
export function verifyVoiceToken(userId: number, roomId: string, token: string | null): string | null {
  if (!token) return 'Missing voice token'
  const dot = token.indexOf('.')
  if (dot < 1) return 'Malformed voice token'
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = parseInt(expStr, 10)
  if (isNaN(exp) || exp < Date.now()) return 'Voice token expired'
  const payload = `${userId}.${roomId}.${exp}`
  const expected = createHmac('sha256', signalSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'Invalid voice token signature'
  return null
}
