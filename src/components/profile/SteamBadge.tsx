"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Clock, BadgeCheck, X } from "lucide-react";
import { haptic } from "@/lib/telegram/haptics";

/** Official Steam logo (simplified monochrome path, colored via prop) */
export function SteamLogo({ className, color }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        fill={color ?? "currentColor"}
        d="M12 2C6.86 2 2.67 5.93 2.07 10.91c.03.01 3.79 1.01 3.79 1.01a4.35 4.35 0 0 1 3.9-2.42c.15 0 .3.01.45.02l3.06-4.43v-.06A7.53 7.53 0 0 1 12 2Zm5.54 3.36a7.49 7.49 0 0 1 1.94 5.03v.06a7.49 7.49 0 0 1-7.49 7.49h-.06l-4.4-3.13a4.36 4.36 0 0 1-4.06-2.06L2 12.36A10 10 0 1 0 17.54 5.36Zm-7.32 12.4 2.7 1.92a4.35 4.35 0 0 1-2.7-1.93Zm2.7 1.92c.02 0 .03.01.05.01Zm2.36-9.5a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm0 .73a2.17 2.17 0 1 1 0 4.34 2.17 2.17 0 0 1 0-4.34ZM9.7 10.9a3.63 3.63 0 0 0-3.34 2.2l1.98.53a1.93 1.93 0 0 1 3.55.4l.32.23a3.63 3.63 0 0 0-2.5-3.36Zm-3.34 2.2c-.05.1-.09.21-.13.32.04-.1.08-.21.13-.32Z"
      />
    </svg>
  );
}

interface Props {
  connected: boolean;
  personaName?: string | null;
  /** compact = header chip, full = profile account card */
  size?: "sm" | "lg";
}

/**
 * SteamBadge — neon Steam icon with a "connected" checkmark.
 * Tapping opens an info popup explaining what Steam linking gives you:
 * original-account verification, played hours display, fake protection.
 */
export function SteamBadge({ connected, personaName, size = "sm" }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);

  const openInfo = () => {
    haptic.impact("light");
    setInfoOpen(true);
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={(e) => {
          e.stopPropagation();
          openInfo();
        }}
        className="relative inline-flex items-center justify-center"
        aria-label="Steam подключён — что это даёт?"
      >
        <span
          className={`${size === "lg" ? "w-11 h-11" : "w-9 h-9"} rounded-xl flex items-center justify-center`}
          style={{
            background: connected
              ? "linear-gradient(135deg, #1b2838 0%, #0f171f 100%)"
              : "rgba(255,255,255,0.05)",
            border: connected
              ? "1px solid rgba(102,192,244,0.5)"
              : "1px solid rgba(255,255,255,0.1)",
            boxShadow: connected
              ? "0 0 16px rgba(102,192,244,0.4), inset 0 0 12px rgba(102,192,244,0.1)"
              : "none",
          }}
        >
          <SteamLogo
            className={size === "lg" ? "w-6 h-6" : "w-5 h-5"}
            color={connected ? "#66c0f4" : "rgba(255,255,255,0.35)"}
          />
        </span>

        {/* Checkmark badge */}
        {connected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 300, delay: 0.2 }}
            className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center border-2"
            style={{
              width: 18,
              height: 18,
              background: "#3FB950",
              borderColor: "#0e141d",
              boxShadow: "0 0 8px rgba(63,185,80,0.7)",
            }}
          >
            <BadgeCheck className="w-2.5 h-2.5 text-[#0e141d]" strokeWidth={3} />
          </motion.span>
        )}
      </motion.button>

      {/* ── Info popup ── */}
      <AnimatePresence>
        {infoOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(5, 8, 12, 0.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            onClick={() => setInfoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 18, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
              className="glass-card p-5 w-full max-w-xs"
              onClick={(e) => e.stopPropagation()}
              style={{ borderColor: connected ? "rgba(102,192,244,0.4)" : undefined }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #1b2838 0%, #0f171f 100%)",
                      border: "1px solid rgba(102,192,244,0.5)",
                      boxShadow: "0 0 14px rgba(102,192,244,0.35)",
                    }}
                  >
                    <SteamLogo className="w-5 h-5" color="#66c0f4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Steam</p>
                    <p className="text-[11px] text-muted-foreground">
                      {connected
                        ? personaName
                          ? `Подключён · ${personaName}`
                          : "Подключён"
                        : "Не подключён"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInfoOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs font-semibold mb-2.5">Что даёт привязка Steam:</p>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#66c0f4" }} />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <b className="text-foreground">Подтверждение оригинального аккаунта</b> — твой
                    профиль получает проверенный бейдж, видно, что ты реальный владелец Steam-аккаунта.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#66c0f4" }} />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <b className="text-foreground">Наигранные часы</b> — напарники видят твой опыт
                    в играх и быстрее находят лобби своего уровня.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#66c0f4" }} />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <b className="text-foreground">Защита от фейков</b> — Steam OpenID проверяется
                    на стороне Steam, выдать чужой аккаунт невозможно.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
