"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Crown, Star } from "lucide-react";
import type { UserRow } from "@/lib/supabase/client";
import { RankMedal } from "@/components/icons";
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" fill="currentColor" />
            Топ игроков
          </h1>
        </div>
      </div>

      {/* Neon strip */}
      <div className="neon-strip" />

      {/* Sort toggle */}
      <div className="flex gap-1 p-1 bg-background/40 rounded-xl border border-border">
        {Object.entries(sortLabels).map(([code, label]) => (
          <button
            key={code}
            onClick={() => setSort(code as typeof sort)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              sort === code ? "neon-btn" : "text-muted-foreground"
            }`}
          >
            {label}
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
                style={isMe ? { boxShadow: "0 0 0 1px var(--primary)" } : undefined}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="w-8 flex justify-center shrink-0">
                    {rank <= 3 ? (
                      <RankMedal rank={rank} className="w-7 h-7" />
                    ) : (
                      <span className="font-bold text-sm">{rank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  {entry.photo_url ? (
                    <img src={entry.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                      {entry.first_name?.[0] ?? "?"}
                    </div>
                  )}

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1">
                      {entry.username ? `@${entry.username}` : entry.first_name}
                      {isMe && <span className="text-[10px] text-primary">(Вы)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {entry.first_name} {entry.last_name}
                    </p>
                  </div>

                  {/* Value */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold neon-text">{value}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
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
