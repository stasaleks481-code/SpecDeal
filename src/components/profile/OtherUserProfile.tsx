"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, Users, MessageCircle, UserPlus, Crown, ShieldCheck } from "lucide-react";
import { REVIEW_TYPES, type UserRow } from "@/lib/supabase/client";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";

interface OtherUser {
  id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  steam_id: string | null;
  trust_score: number;
  reviews_count: number;
  matches_count: number;
  badges: string[];
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
}

interface Review {
  id: string;
  rating_type: keyof typeof REVIEW_TYPES;
  comment: string | null;
  created_at: string;
  from_user: {
    id: number;
    username: string | null;
    first_name: string;
    photo_url: string | null;
  };
}

interface Props {
  currentUser: UserRow;
}

export function OtherUserProfile({ currentUser }: Props) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = parseInt(params.id, 10);

  const [user, setUser] = useState<OtherUser | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const goBack = useCallback(() => router.push("/leaderboard"), [router]);
  useTelegramBackButton(goBack);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${userId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Not found");
      }
      const data = await res.json();
      setUser(data.user);
      setReviews(data.reviews ?? []);
      setReviewCounts(data.review_counts ?? {});
    } catch (err) {
      console.error("[profile] error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const sendDM = () => {
    router.push(`/dm/${userId}`);
  };

  const addFriend = async () => {
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target_id: userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accepted) {
          alert("✅ Вы теперь друзья!");
        } else {
          alert("📨 Заявка отправлена");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <p className="text-sm font-semibold mb-2">Игрок не найден</p>
          <button onClick={() => router.push("/leaderboard")} className="neon-btn text-xs w-full">
            К лидерборду
          </button>
        </div>
      </div>
    );
  }

  const trustLevel = user.reviews_count === 0
    ? "Нейтрально"
    : user.trust_score >= 50 ? "Высокий" : user.trust_score >= 20 ? "Средний" : "Низкий";
  const trustColor = user.reviews_count === 0
    ? "#66c0f4"
    : user.trust_score >= 50 ? "#3FB950" : user.trust_score >= 20 ? "#F7A600" : "#DA3030";

  const isMe = user.id === currentUser.id;

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/leaderboard")}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Профиль игрока</h1>
      </div>

      <div className="neon-strip" />

      {/* Profile card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-[#1b2838]/40">
        <div className="neon-strip" />
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              {user.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.first_name}
                  className="w-20 h-20 rounded-2xl object-cover border-2"
                  style={{ borderColor: "var(--primary)" }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl font-bold neon-text border-2 border-primary">
                  {user.first_name?.[0] ?? "?"}
                </div>
              )}
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                style={{ background: trustColor, borderColor: "#0e141d" }}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#0e141d]" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate leading-tight">
                {user.first_name} {user.last_name}
              </h1>
              {user.username && (
                <p className="text-sm text-muted-foreground mt-0.5">@{user.username}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: `${trustColor}20`, color: trustColor, border: `1px solid ${trustColor}40` }}
                >
                  {trustLevel} доверие
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  {user.is_online ? "🟢 онлайн" : "⚪ оффлайн"}
                </span>
              </div>
            </div>
          </div>

          {/* Badges */}
          {user.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {user.badges.includes("verified") && (
                <span className="text-[10px] px-2 py-1 rounded-full font-semibold flex items-center gap-1"
                  style={{ background: "#3FB95020", color: "#3FB950", border: "1px solid #3FB95040" }}
                >
                  <ShieldCheck className="w-3 h-3" /> Steam Verified
                </span>
              )}
              {user.badges.includes("captain") && (
                <span className="text-[10px] px-2 py-1 rounded-full font-semibold flex items-center gap-1"
                  style={{ background: "#F7A60020", color: "#F7A600", border: "1px solid #F7A60040" }}
                >
                  <Crown className="w-3 h-3" fill="currentColor" /> Капитан
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="stat-block">
          <div className="stat-block__value">{user.matches_count}</div>
          <div className="stat-block__label">Матчей</div>
        </div>
        <div className="stat-block">
          <div className="stat-block__value">{user.reviews_count}</div>
          <div className="stat-block__label">Отзывов</div>
        </div>
        <div className="stat-block">
          <div className="stat-block__value" style={{ color: trustColor }}>{user.trust_score}</div>
          <div className="stat-block__label">Рейтинг</div>
        </div>
      </div>

      {/* Action buttons */}
      {!isMe && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={sendDM} className="neon-btn text-sm flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Написать
          </button>
          <button onClick={addFriend} className="glass-card text-sm font-semibold py-2.5 flex items-center justify-center gap-2 hover:border-primary/40">
            <UserPlus className="w-4 h-4" />
            В друзья
          </button>
        </div>
      )}

      {/* Reviews summary */}
      <div className="glass-card p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" fill="currentColor" />
          Отзывы ({user.reviews_count})
        </h3>

        {Object.keys(reviewCounts).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Пока нет отзывов. Поиграй с этим игроком!
          </p>
        ) : (
          <>
            {/* Review type counts */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(reviewCounts).map(([type, count]) => {
                const info = REVIEW_TYPES[type as keyof typeof REVIEW_TYPES];
                if (!info) return null;
                return (
                  <span
                    key={type}
                    className="chip"
                    style={{
                      background: count > 0 && (type === "toxic" || type === "leaver")
                        ? "rgba(218, 48, 48, 0.15)"
                        : "rgba(0, 240, 255, 0.10)",
                      borderColor: count > 0 && (type === "toxic" || type === "leaver")
                        ? "rgba(218, 48, 48, 0.3)"
                        : "var(--border)",
                    }}
                  >
                    {info.emoji} {info.label} ×{count}
                  </span>
                );
              })}
            </div>

            {/* Recent reviews */}
            <div className="space-y-2">
              {reviews.slice(0, 5).map((review) => {
                const info = REVIEW_TYPES[review.rating_type];
                return (
                  <div key={review.id} className="flex gap-2 p-2 rounded-lg bg-background/30">
                    {review.from_user.photo_url ? (
                      <img src={review.from_user.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                        {review.from_user.first_name?.[0] ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-semibold">
                          {review.from_user.username ? `@${review.from_user.username}` : review.from_user.first_name}
                        </span>
                        {" — "}
                        <span>{info?.emoji} {info?.label}</span>
                      </p>
                      {review.comment && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{review.comment}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
