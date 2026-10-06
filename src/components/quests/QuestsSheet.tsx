"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Loader2, Check, Sparkles } from "lucide-react";
import { QUEST_DEFS, type QuestDef } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";
import { CoinIcon, QuestGlyph } from "@/components/cosmetics";

/**
 * QuestsSheet — daily tasks with VoiceDeck Coin rewards.
 * Entry points: home quest strip, profile.
 */

interface QuestState extends QuestDef {
  progress: number;
  claimed: boolean;
  ready: boolean;
}

export function QuestsSheet({
  open,
  onClose,
  onOpenShop,
  onCoinsChange,
}: {
  open: boolean;
  onClose: () => void;
  onOpenShop?: () => void;
  onCoinsChange?: (coins: number) => void;
}) {
  const [coins, setCoins] = useState(0);
  const [quests, setQuests] = useState<QuestState[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<{ code: string; reward: number } | null>(null);

  // Stable callback ref — prevents the load() useCallback (and thus the
  // open-effect) from re-firing on every parent render
  const onCoinsRef = useRef(onCoinsChange);
  useEffect(() => {
    onCoinsRef.current = onCoinsChange;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quests", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCoins(data.coins ?? 0);
        setQuests(data.quests ?? []);
        onCoinsRef.current?.(data.coins ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setJustClaimed(null);
      load();
    }
  }, [open, load]);

  const claim = async (code: string) => {
    setClaiming(code);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        haptic.success();
        setJustClaimed({ code, reward: data.reward ?? 0 });
        setCoins(data.coins ?? 0);
        onCoinsRef.current?.(data.coins ?? 0);
        setQuests((prev) =>
          prev.map((q) => (q.code === code ? { ...q, claimed: true, ready: false } : q))
        );
        setTimeout(() => setJustClaimed(null), 1800);
      } else {
        haptic.error();
        // Refresh state in case of drift
        load();
      }
    } finally {
      setClaiming(null);
    }
  };

  const readyCount = quests.filter((q) => q.ready).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md rounded-t-3xl flex flex-col"
            style={{
              height: "82vh",
              background: "linear-gradient(180deg, rgba(17,24,35,0.98), rgba(11,17,26,0.99))",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 pb-3 border-b border-border shrink-0">
              <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mb-3" />
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(140deg, rgba(255,215,111,0.3), rgba(255,157,61,0.15))",
                    border: "1px solid rgba(255,215,111,0.35)",
                  }}
                >
                  <Gift className="w-5 h-5 text-[#ffd76f]" />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-bold">Задания дня</h2>
                  <p className="text-[10px] text-muted-foreground">
                    Обновятся в 03:00 МСК — успей забрать награды
                  </p>
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,215,111,0.16), rgba(255,157,61,0.08))",
                    border: "1px solid rgba(255,215,111,0.35)",
                  }}
                >
                  <CoinIcon size={14} />
                  <span className="text-xs font-black text-[#ffd76f]">{coins}</span>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {loading ? (
                <div className="py-14 text-center text-sm text-muted-foreground">Загружаем задания...</div>
              ) : (
                quests.map((q, idx) => {
                  const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
                  return (
                    <motion.div
                      key={q.code}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="room-card !p-3.5 flex items-center gap-3"
                      style={
                        q.ready
                          ? { borderColor: "rgba(255,215,111,0.45)", boxShadow: "0 0 18px -6px rgba(255,215,111,0.35)" }
                          : undefined
                      }
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: q.claimed
                            ? "rgba(63,185,80,0.14)"
                            : "linear-gradient(140deg, rgba(255,215,111,0.14), rgba(255,157,61,0.06))",
                          border: "1px solid rgba(255,215,111,0.22)",
                        }}
                      >
                        {q.claimed ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : (
                          <QuestGlyph icon={q.icon} className="w-5 h-5 text-[#ffd76f]" />
                        )}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-tight">{q.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{q.desc}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                background: q.claimed
                                  ? "rgba(63,185,80,0.7)"
                                  : "linear-gradient(90deg, #ffd76f, #ff9d3d)",
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4, ease: "easeOut" }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                            {q.progress}/{q.target}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 self-center">
                        {q.claimed ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-green-400/80 px-2">
                            +{q.reward}
                          </span>
                        ) : q.ready ? (
                          <button
                            onClick={() => claim(q.code)}
                            disabled={claiming === q.code}
                            className="text-[11px] font-black px-3.5 py-2 rounded-xl text-[#2b1a04] flex items-center gap-1 active:scale-95 transition-transform"
                            style={{
                              background: "linear-gradient(135deg, #ffd76f, #ff9d3d)",
                              boxShadow: "0 6px 16px -6px rgba(255,182,72,0.6)",
                            }}
                          >
                            {claiming === q.code ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CoinIcon size={13} />
                            )}
                            Забрать
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-black text-[#ffd76f]/80">
                            <CoinIcon size={12} />+{q.reward}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}

              {/* Claimed toast */}
              <AnimatePresence>
                {justClaimed && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="fixed left-1/2 -translate-x-1/2 bottom-24 z-10 flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                    style={{
                      background: "linear-gradient(135deg, #ffd76f, #ff9d3d)",
                      boxShadow: "0 12px 30px -8px rgba(255,182,72,0.7)",
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-[#2b1a04]" />
                    <span className="text-xs font-black text-[#2b1a04]">
                      +{justClaimed.reward} VoiceDeck Coins!
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer → shop */}
            <div className="p-4 pt-3 border-t border-border shrink-0">
              <button
                onClick={() => {
                  haptic.impact("light");
                  onOpenShop?.();
                }}
                className="neon-btn w-full text-sm"
              >
                <Sparkles className="w-4 h-4" />
                {readyCount > 0 ? "Тратить монеты в магазине" : "Открыть магазин"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
