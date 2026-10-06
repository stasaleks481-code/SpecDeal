"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, ShieldCheck, Users, Trophy } from "lucide-react";
import { SteamLogo } from "@/components/profile/SteamBadge";
import { GamesTab } from "@/components/games/GamesTab";
import { RankMedal } from "@/components/icons";
import { UserAvatar, UserName } from "@/components/cosmetics";
import type { UserRow } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";

/**
 * SteamHub — the dedicated Steam / PC-gaming tab (/pc):
 * Steam account card, LFG (тиммейты по ПК-играм), Steam leaderboard.
 */
type SteamTab = "lfg" | "rating";

interface SteamEntry {
  id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  trust_score: number;
  reviews_count: number;
  matches_count: number;
  avatar_frame: string | null;
  name_style: string | null;
  user_title: string | null;
  steam_data: { persona_name?: string } | null;
}

export function SteamHub({ user }: { user: UserRow }) {
  const router = useRouter();
  const [tab, setTab] = useState<SteamTab>("lfg");
  const [entries, setEntries] = useState<SteamEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const isLinked = Boolean(user.steam_id);

  const loadRating = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leaderboard?sort=races&steam=1&limit=15", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.leaderboard ?? []);
        setMyRank(data.my_rank ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "rating") loadRating();
  }, [tab, loadRating]);

  return (
    <div>
      {/* ── Hero — Steam dark blue duotone ── */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <div
          className="vd-hero"
          style={
            {
              background: "linear-gradient(135deg, #1b2838 0%, #2a475e 55%, #66c0f4 140%)",
              "--hero-color": "#66c0f4",
            } as React.CSSProperties
          }
        >
          <div className="flex items-center gap-3.5">
            <div
              className="vd-tile w-12 h-12"
              style={{ background: "rgba(103,194,244,0.14)", borderColor: "rgba(103,194,244,0.35)" }}
            >
              <SteamLogo className="w-6 h-6" color="#66c0f4" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black leading-tight tracking-tight">Steam Хаб</h1>
              <p className="text-xs text-white/75 mt-1 font-medium">
                ПК-игры, тиммейты и рейтинг в Steam
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Steam account card ── */}
      <div className="max-w-md mx-auto px-4 pt-3">
        {isLinked ? (
          <div className="room-card flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(140deg, rgba(103,194,244,0.2), rgba(27,40,56,0.4))",
                border: "1px solid rgba(103,194,244,0.4)",
                boxShadow: "0 0 16px -6px rgba(102,192,244,0.5)",
              }}
            >
              <ShieldCheck className="w-5 h-5 text-[#66c0f4]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold flex items-center gap-1.5">
                Steam подключен
                <ShieldCheck className="w-3.5 h-3.5 text-[#66c0f4]" />
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {(user.steam_data as { persona_name?: string } | null)?.persona_name ??
                  `SteamID: ${user.steam_id}`}
              </p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-[#66c0f4] px-2 py-1 rounded-full bg-[#66c0f4]/10 border border-[#66c0f4]/30 shrink-0">
              Verified
            </span>
          </div>
        ) : (
          <div className="room-card flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(140deg, rgba(103,194,244,0.14), rgba(27,40,56,0.3))",
                border: "1px dashed rgba(103,194,244,0.4)",
              }}
            >
              <SteamLogo className="w-5 h-5" color="#66c0f4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Подключи Steam</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Верифицированный бейдж и рейтинг в Steam
              </p>
            </div>
            <button
              onClick={() => {
                haptic.impact("medium");
                window.location.href = "/api/auth/steam?mode=link";
              }}
              className="text-[11px] font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform text-[#0d1117]"
              style={{
                background: "linear-gradient(135deg, #8ed0f8, #66c0f4)",
                boxShadow: "0 6px 18px -6px rgba(102,192,244,0.6)",
              }}
            >
              <Link2 className="w-3.5 h-3.5" />
              Связать
            </button>
          </div>
        )}
      </div>

      {/* ── Segmented control: LFG / Rating ── */}
      <div className="sticky z-10 mt-3 border-b border-border"
        style={{
          top: 64,
          background: "linear-gradient(180deg, rgba(11,17,26,0.96) 0%, rgba(11,17,26,0.88) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-md mx-auto px-4 py-2.5">
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-2xl border border-border"
            style={{
              background: "rgba(255,255,255,0.035)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 20px -12px rgba(0,0,0,0.6)",
            }}
          >
            {(
              [
                { id: "lfg", label: "Тиммейты", icon: <Users className="w-4 h-4" /> },
                { id: "rating", label: "Рейтинг Steam", icon: <Trophy className="w-4 h-4" /> },
              ] as { id: SteamTab; label: string; icon: React.ReactNode }[]
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    haptic.impact("light");
                    setTab(t.id);
                    window.scrollTo(0, 0);
                  }}
                  className={`relative flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    active ? "text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="steam-tab-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: "linear-gradient(135deg, #2a475e, #66c0f4)",
                        boxShadow: "0 6px 18px -6px rgba(102,192,244,0.5), 0 1px 0 rgba(255,255,255,0.3) inset",
                      }}
                      transition={{ type: "spring", damping: 26, stiffness: 320 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {t.icon}
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.13, ease: "easeOut" }}
        >
          {tab === "lfg" ? (
            <GamesTab user={user} embedded />
          ) : (
            <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-4">
              {loading ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Загружаем рейтинг...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <SteamLogo className="w-10 h-10 mx-auto text-[#66c0f4]/50" />
                  <p className="text-sm font-semibold mt-3">Пока нет Steam-игроков</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Подключи Steam и стань первым в рейтинге
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry, idx) => {
                    const rank = idx + 1;
                    const isMe = entry.id === user.id;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => router.push(`/users/${entry.id}`)}
                        className={`room-card w-full text-left ${isMe ? "border-primary/50" : ""}`}
                        style={
                          isMe
                            ? { boxShadow: "0 0 0 1.5px color-mix(in srgb, var(--primary) 65%, transparent), 0 0 20px -6px color-mix(in srgb, var(--primary) 40%, transparent)" }
                            : rank <= 3
                              ? { borderColor: "rgba(102,192,244,0.35)" }
                              : undefined
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 flex justify-center shrink-0">
                            {rank <= 3 ? (
                              <RankMedal rank={rank} className="w-8 h-8 drop-shadow-[0_0_8px_rgba(102,192,244,0.45)]" />
                            ) : (
                              <span className="font-black text-sm text-muted-foreground">{rank}</span>
                            )}
                          </div>
                          <UserAvatar user={entry} size={40} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate flex items-center gap-1">
                              <UserName user={entry} fallback={entry.username ? `@${entry.username}` : entry.first_name} />
                              {isMe && <span className="text-[10px] text-primary font-black">(Вы)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.steam_data?.persona_name ?? entry.first_name}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-black neon-text leading-none">{entry.matches_count}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">каток</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {myRank && myRank > 15 && (
                    <div className="glass-card p-3 text-center">
                      <p className="text-sm">
                        Ты на <span className="font-bold neon-text">#{myRank}</span> месте
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
