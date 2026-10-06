/**
 * Telegram WebApp haptic feedback helpers.
 * Falls back to no-op when not in Telegram context.
 *
 * Usage:
 *   import { haptic } from "@/lib/telegram/haptics"
 *   haptic.impact("light")   // soft tap on button press
 *   haptic.success()         // green checkmark vibration
 *   haptic.error()           // red error buzz
 *   haptic.selection()      // tick when changing selection
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft"
type NotificationType = "error" | "success" | "warning"

interface TelegramWebApp {
  HapticFeedback?: {
    impactOccurred: (style: ImpactStyle) => void
    notificationOccurred: (type: NotificationType) => void
    selectionChanged: () => void
  }
}

function getTg(): TelegramWebApp | null {
  if (typeof window === "undefined") return null
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
  return tg?.WebApp ?? null
}

export const haptic = {
  impact(style: ImpactStyle = "light") {
    try {
      getTg()?.HapticFeedback?.impactOccurred(style)
    } catch {
      // no-op
    }
  },
  success() {
    try {
      getTg()?.HapticFeedback?.notificationOccurred("success")
    } catch {
      // no-op
    }
  },
  error() {
    try {
      getTg()?.HapticFeedback?.notificationOccurred("error")
    } catch {
      // no-op
    }
  },
  warning() {
    try {
      getTg()?.HapticFeedback?.notificationOccurred("warning")
    } catch {
      // no-op
    }
  },
  selection() {
    try {
      getTg()?.HapticFeedback?.selectionChanged()
    } catch {
      // no-op
    }
  },
}
