"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Crown, Star } from "lucide-react";
import type { UserRow } from "@/lib/supabase/client";
import { RankMedal } from "@/components/icons";
import { UserAvatar, UserName } from "@/components/cosmetics";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";

interface LeaderEntry {
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
}

interface Props {
  currentUser: UserRow;
}

export function LeaderboardView({ currentUser }: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<"trust" | "races" | "reviews">("trust");
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const goBack = useCallback(() => router.push("/"), [router]);
  useTelegramBackButton(goBack);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?sort=${sort}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.leaderboard ?? []);
        setMyRank(data.my_rank);
      }
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const sortLabels: Record<string, string> = {
    trust: "По рейтингу",
    races: "По матчам",
    reviews: "По отзывам",
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-4">
      {/* Header — gold hero */}
      <div className="vd-hero" style={{ background: "var(--grad-gold)", "--hero-color": "#ffb648" } as React.CSSProperties}>
        <div className="flex items-center gap-3.5">
          <div className="vd-tile w-12 h-12" style={{ background: "rgba(58,37,6,0.35)", borderColor: "rgba(58,37,6,0.4)" }}>
            <Crown className="w-5 h-5 text-[#fff3d0]" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black leading-tight tracking-tight text-[#2b1a04]">Топ игроков</h1>
            <p className="text-xs text-[#4a3208]/80 mt-1 font-bold">
              Лучшие из лучших — рейтинг, матчи, отзывы
            </p>
          </div>
        </div>
      </div>

      {/* Sort toggle */}
      <div
        className="flex gap-1 p-1 rounded-2xl border border-border"
        style={{
          background: "rgba(255,255,255,0.035)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 20px -12px rgba(0,0,0,0.6)",
        }}
      >
        {Object.entries(sortLabels).map(([code, label]) => (
          <button
            key={code}
            onClick={() => setSort(code as typeof sort)}
            className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              sort === code ? "text-[#2b1a04]" : "text-muted-foreground"
            }`}
          >
            {sort === code && (
              <motion.span
                layoutId="lb-sort-pill"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "var(--grad-gold)",
                  boxShadow: "0 6px 16px -6px rgba(255,182,72,0.55), 0 1px 0 rgba(255,255,255,0.4) inset",
                }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      {/* Leaderboard list */}
      {loading ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Загружаем топ...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm font-semibold">Пока пусто</p>
          <p className="text-xs text-muted-foreground mt-1">
            Стань первым в рейтинге!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const rank = idx + 1;
            const isMe = entry.id === currentUser.id;
            const value =
              sort === "trust" ? entry.trust_score :
              sort === "races" ? entry.matches_count :
              entry.reviews_count;
            const valueLabel =
              sort === "trust" ? "рейтинг" :
              sort === "races" ? "матчей" :
              "отзывов";

            return (
              <button
                key={entry.id}
                onClick={() => router.push(`/users/${entry.id}`)}
                className={`room-card w-full text-left ${isMe ? "border-primary/50" : ""}`}
                style={isMe ? { boxShadow: "0 0 0 1.5px color-mix(in srgb, var(--primary) 65%, transparent), 0 0 20px -6px color-mix(in srgb, var(--primary) 40%, transparent)" } : rank <= 3 ? { borderColor: "rgba(255,200,90,0.3)" } : undefined}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="w-8 flex justify-center shrink-0">
                    {rank <= 3 ? (
                      <RankMedal rank={rank} className="w-8 h-8 drop-shadow-[0_0_8px_rgba(255,190,80,0.45)]" />
                    ) : (
                      <span className="font-black text-sm text-muted-foreground">{rank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <UserAvatar user={entry} size={40} />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate flex items-center gap-1">
                      <UserName user={entry} fallback={entry.username ? `@${entry.username}` : entry.first_name} />
                      {isMe && <span className="text-[10px] text-primary font-black">(Вы)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {entry.first_name} {entry.last_name}
                    </p>
                  </div>

                  {/* Value */}
                  <div className="text-right shrink-0">
                    <p className="text-base font-black neon-text leading-none">{value}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">
                      {valueLabel}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* My rank (if not in top 10) */}
      {myRank && myRank > 10 && (
        <div className="glass-card p-3 text-center">
          <p className="text-sm">
            Ты на <span className="font-bold neon-text">#{myRank}</span> месте
          </p>
        </div>
      )}
    </div>
  );
}
