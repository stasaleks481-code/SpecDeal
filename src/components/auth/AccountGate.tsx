"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Gamepad2, Lock, ShieldCheck, ChevronRight } from "lucide-react";
import { haptic } from "@/lib/telegram/haptics";
import type { UserRow } from "@/lib/supabase/client";

interface Props {
  user: UserRow;
  /** Whether Telegram initData is available in the current context */
  hasTelegramContext: boolean;
  onUpgraded: (u: UserRow) => void;
  onDismiss: () => void;
}

/**
 * AccountGate — full-screen overlay shown for anonymous profiles.
 * Explains the limitation and offers two unlock paths:
 *   1. Telegram (instant — initData is already validated)
 *   2. Steam (OpenID redirect)
 */
export function AccountGate({ user, hasTelegramContext, onUpgraded, onDismiss }: Props) {
  const [loading, setLoading] = useState<"tg" | "steam" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upgradeTelegram = async () => {
    haptic.impact("medium");
    setLoading("tg");
    setError(null);
    try {
      let initData = "";
      const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
      initData = tg?.WebApp?.initData ?? "";

      if (!initData) {
        setError(
          "Вход через Telegram доступен внутри Mini App. Открой VoiceDeck через бота @stakappBot"
        );
        setLoading(null);
        return;
      }

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ initData, upgrade_anon_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        throw new Error(data.error ?? "Ошибка входа");
      }
      haptic.success();
      onUpgraded(data.user);
    } catch (err) {
      console.error("[gate] tg upgrade error:", err);
      setError(err instanceof Error ? err.message : "Ошибка");
      setLoading(null);
    }
  };

  const goToSteam = () => {
    haptic.impact("medium");
    setLoading("steam");
    // Full page navigation to Steam OpenID; callback returns to /
    window.location.href = `/api/auth/steam?mode=login&anon=${user.id}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          background: "rgba(10, 14, 20, 0.82)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="w-full max-w-md"
        >
          <div
            className="rounded-3xl border border-border overflow-hidden relative"
            style={{
              background: "linear-gradient(180deg, rgba(22,32,46,0.96) 0%, rgba(13,19,28,0.99) 55%)",
              boxShadow: "var(--shadow-pop)",
            }}
          >
            {/* Aurora glow on top */}
            <div
              className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
              style={{
                background:
                  "radial-gradient(300px 130px at 20% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%), radial-gradient(260px 130px at 85% 0%, rgba(123,92,240,0.14), transparent 70%)",
              }}
            />
            {/* Header */}
            <div className="relative px-6 pt-7 pb-5 text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center vd-tile"
                style={{
                  background: "linear-gradient(140deg, color-mix(in srgb, var(--primary) 32%, transparent), rgba(123,92,240,0.15))",
                  boxShadow: "0 10px 28px -8px color-mix(in srgb, var(--primary) 45%, transparent)",
                }}
              >
                <Lock className="w-7 h-7 neon-text" />
              </div>
              <h2 className="text-xl font-black vd-gradient-text">Анонимный профиль</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Создание комнат и голосовые звонки заблокированы.
                <br />
                Выбери основной тип аккаунта, чтобы разблокировать всё.
              </p>
            </div>

            {/* Options */}
            <div className="px-5 pb-2 space-y-3">
              {/* Telegram */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={upgradeTelegram}
                disabled={loading !== null}
                className="w-full p-4 rounded-2xl border border-border flex items-center gap-3 text-left transition-colors hover:border-[#229ED9]/60 disabled:opacity-50"
                style={{ background: "rgba(34, 158, 217, 0.08)" }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(34, 158, 217, 0.18)" }}>
                  <Send className="w-5 h-5 text-[#229ED9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">Продолжить с Telegram</h3>
                    {hasTelegramContext && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase">
                        быстро
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Основной профиль TG + привязка Steam позже
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </motion.button>

              {/* Steam */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={goToSteam}
                disabled={loading !== null}
                className="w-full p-4 rounded-2xl border border-border flex items-center gap-3 text-left transition-colors hover:border-[#66c0f4]/60 disabled:opacity-50"
                style={{ background: "rgba(102, 192, 244, 0.08)" }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(102, 192, 244, 0.18)" }}>
                  <Gamepad2 className="w-5 h-5 text-[#66c0f4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">Продолжить через Steam</h3>
                    <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Официальный вход Steam OpenID
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </motion.button>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-5 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Dismiss */}
            <div className="px-5 py-4">
              <button
                onClick={() => {
                  haptic.impact("light");
                  onDismiss();
                }}
                disabled={loading !== null}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Пока остаться анонимом (ограниченный режим)
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
