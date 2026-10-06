"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2, Star, Users, Crown, ShieldCheck, Sparkles, TrendingUp,
  Send, Link2, Eye, EyeOff, GraduationCap, Settings2, BarChart3, MessageSquareQuote,
  UserX, ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { THEME_COLORS, REVIEW_TYPES, type UserRow, type ThemeColor } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";

interface ReviewItem {
  id: string;
  rating_type: keyof typeof REVIEW_TYPES;
  comment: string | null;
  created_at: string;
  from_user: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  };
}

interface Props {
  user: UserRow;
  onUserUpdate: (u: UserRow) => void;
}

export function ProfileView({ user, onUserUpdate }: Props) {
  const router = useRouter();
  const [linking, setLinking] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [tgToggleBusy, setTgToggleBusy] = useState(false);

  const isAnonymous = user.account_type === "anonymous";
  const isTelegram = user.account_type === "telegram";
  const isSteam = user.account_type === "steam";

  // Fetch reviews about me (lazy — only when tab opened)
  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await fetch("/api/reviews?about=me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews ?? []);
      }
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const setTheme = async (color: ThemeColor) => {
    setThemeError(null);
    try {
      // Optimistic update — apply immediately
      document.documentElement.setAttribute("data-accent", color);
      // Also set cookie directly for instant persistence
      document.cookie = `theme_color=${color}; path=/; max-age=31536000; samesite=lax`;

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme_color: color }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.user) {
        onUserUpdate(data.user);
      }
      haptic.impact("light");
    } catch (err) {
      console.error("[setTheme] error:", err);
      setThemeError(err instanceof Error ? err.message : "Failed");
      document.documentElement.setAttribute("data-accent", user.theme_color);
    }
  };

  const linkSteam = () => {
    haptic.impact("medium");
    setLinking(true);
    // Redirect to Steam OpenID in "link" mode — attaches Steam to this TG account
    window.location.href = "/api/auth/steam?mode=link";
  };

  const toggleTgVisibility = async (checked: boolean) => {
    setTgToggleBusy(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ show_tg_profile: checked }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) onUserUpdate(data.user);
      }
    } finally {
      setTgToggleBusy(false);
    }
  };

  const restartTour = () => {
    try {
      localStorage.removeItem("stakapp_tour_done_v1");
    } catch { /* ignore */ }
    router.push("/");
  };

  const hasReviews = user.reviews_count > 0;
  const trustLevel = !hasReviews
    ? "Нейтрально"
    : user.trust_score >= 50
    ? "Высокий"
    : user.trust_score >= 20
    ? "Средний"
    : "Низкий";
  const trustColor = !hasReviews
    ? "#66c0f4"
    : user.trust_score >= 50
    ? "#3FB950"
    : user.trust_score >= 20
    ? "#F7A600"
    : "#DA3030";

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-4">
      {/* ── Profile header card ── */}
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
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: `${trustColor}20`, color: trustColor, border: `1px solid ${trustColor}40` }}
                >
                  {trustLevel} доверие
                </span>
                {isSteam && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                    style={{ background: "#1b2838", border: "1px solid #66c0f440", color: "#66c0f4" }}
                  >
                    <Gamepad2 className="w-3 h-3" /> Steam
                  </span>
                )}
                {isAnonymous && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    Аноним
                  </span>
                )}
              </div>
            </div>
          </div>

          {user.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {user.badges.includes("verified") && (
                <span
                  className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-semibold"
                  style={{ background: "#3FB95020", color: "#3FB950", border: "1px solid #3FB95040" }}
                >
                  <ShieldCheck className="w-3 h-3" /> Steam подключен
                </span>
              )}
              {user.badges.includes("captain") && (
                <span
                  className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-semibold"
                  style={{ background: "#F7A60020", color: "#F7A600", border: "1px solid #F7A60040" }}
                >
                  <Star className="w-3 h-3" fill="currentColor" /> Капитан
                </span>
              )}
              {user.badges.includes("adequate") && (
                <span
                  className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-semibold"
                  style={{ background: "#00A2FF20", color: "#00A2FF", border: "1px solid #00A2FF40" }}
                >
                  Адекват
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="w-full grid grid-cols-4 bg-background/40 border border-border h-11 p-1 rounded-xl">
          <TabsTrigger value="stats" className="text-[11px] gap-1 rounded-lg data-[state=active]:neon-btn">
            <BarChart3 className="w-3.5 h-3.5" />
            Стата
          </TabsTrigger>
          <TabsTrigger value="account" className="text-[11px] gap-1 rounded-lg data-[state=active]:neon-btn">
            <Link2 className="w-3.5 h-3.5" />
            Аккаунт
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-[11px] gap-1 rounded-lg data-[state=active]:neon-btn">
            <Settings2 className="w-3.5 h-3.5" />
            Настройки
          </TabsTrigger>
          <TabsTrigger
            value="reviews"
            className="text-[11px] gap-1 rounded-lg data-[state=active]:neon-btn"
            onClick={() => reviews.length === 0 && loadReviews()}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            Отзывы
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Stats ── */}
        <TabsContent value="stats" className="mt-4 space-y-4">
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

          {/* Trust progress */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Trust Score
              </h3>
              <span className="text-xs font-bold" style={{ color: trustColor }}>{trustLevel}</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, ((user.trust_score + 30) / 100) * 100))}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ background: `linear-gradient(90deg, ${trustColor}80, ${trustColor})` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Растёт от положительных отзывов после игр и общения
            </p>
          </div>

          {/* Leaderboard CTA */}
          <button
            onClick={() => router.push("/leaderboard")}
            className="room-card w-full flex items-center gap-3 text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-400" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Топ игроков</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Лидерборд и рейтинги</p>
            </div>
            <Crown className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* History summary */}
          <div className="glass-card p-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              История матчей
            </h3>
            <p className="text-xs text-muted-foreground">
              {user.matches_count > 0
                ? `Сыграно каток: ${user.matches_count}. Заходи в лобби, чтобы увеличить счётчик.`
                : "Сыграй первую катку — счётчик появится здесь."}
            </p>
          </div>
        </TabsContent>

        {/* ── TAB: Account ── */}
        <TabsContent value="account" className="mt-4 space-y-4">
          {/* Anonymous upgrade CTA */}
          {isAnonymous && (
            <div className="rounded-2xl border border-amber-400/30 p-4" style={{ background: "rgba(255,182,39,0.06)" }}>
              <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2">
                <UserX className="w-4 h-4" />
                Анонимный профиль
              </h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">
                Создание комнат и звонки заблокированы. Выбери основной тип аккаунта на главной, чтобы разблокировать.
              </p>
              <button onClick={() => router.push("/")} className="neon-btn text-xs w-full">
                Выбрать тип аккаунта
              </button>
            </div>
          )}

          {/* Steam link (Telegram-primary) */}
          {isTelegram && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 flex items-center gap-3 border-b border-border">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #1b2838, #0e141d)", border: "1px solid #66c0f430" }}
                >
                  <Gamepad2 className="w-5 h-5 text-[#66c0f4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    Steam
                    {user.steam_id && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1"
                        style={{ background: "#3FB95020", color: "#3FB950" }}
                      >
                        <ShieldCheck className="w-2.5 h-2.5" /> подключен
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {user.steam_id
                      ? (user.steam_data as { persona_name?: string } | null)?.persona_name ?? `ID: ${user.steam_id}`
                      : "Привяжи для бейджа верификации"}
                  </p>
                </div>
                {!user.steam_id && (
                  <button
                    onClick={linkSteam}
                    disabled={linking}
                    className="neon-btn text-[11px] shrink-0 flex items-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {linking ? "Открываем..." : "Привязать"}
                  </button>
                )}
              </div>

              {/* Telegram identity row */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(34, 158, 217, 0.15)" }}>
                  <Send className="w-5 h-5 text-[#229ED9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">Telegram — основной</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {user.username ? `@${user.username}` : "Профиль из Telegram"}
                  </p>
                </div>
                <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
              </div>
            </div>
          )}

          {/* Steam-primary account card */}
          {isSteam && (
            <div className="space-y-4">
              <div className="glass-card overflow-hidden">
                <div className="p-4 flex items-center gap-3 border-b border-border">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #1b2838, #0e141d)", border: "1px solid #66c0f430" }}
                  >
                    <Gamepad2 className="w-5 h-5 text-[#66c0f4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">Steam — основной</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {user.steam_id ? `SteamID: ${user.steam_id}` : ""}
                    </p>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
                </div>
              </div>

              {/* Linked Telegram profile */}
              <div className="glass-card p-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <Send className="w-4 h-4 text-[#229ED9]" />
                  Привязанный Telegram
                </h3>

                {user.tg_link_data ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
                    {user.tg_link_data.photo_url ? (
                      <img src={user.tg_link_data.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                        {user.tg_link_data.first_name?.[0] ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {user.tg_link_data.first_name} {user.tg_link_data.last_name ?? ""}
                      </p>
                      {user.tg_link_data.username && (
                        <p className="text-xs text-muted-foreground">@{user.tg_link_data.username}</p>
                      )}
                    </div>
                    <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-border text-center">
                    <p className="text-xs text-muted-foreground mb-2">
                      Открой StakApp через Telegram, чтобы привязать TG-профиль автоматически
                    </p>
                    <a
                      href="https://t.me/stakappBot"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80"
                    >
                      Открыть бота <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Privacy toggle */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      {user.show_tg_profile ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      Показывать TG-профиль другим
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Когда выключено — другие игроки не увидят твою привязку
                    </p>
                  </div>
                  <Switch
                    checked={user.show_tg_profile}
                    onCheckedChange={toggleTgVisibility}
                    disabled={tgToggleBusy || !user.tg_link_data}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Anonymous: linked nothing yet — show info */}
          {isAnonymous && (
            <div className="glass-card p-4">
              <h3 className="font-semibold text-sm mb-1">Что дают аккаунты?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <b className="text-[#229ED9]">Telegram</b> — мгновенный вход внутри Mini App, полный функционал + привязка Steam.
                <br />
                <b className="text-[#66c0f4]">Steam</b> — вход через Steam OpenID, верифицированный бейдж, привязка TG опционально.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Settings ── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          {/* Theme picker */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Тема оформления</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Включая классический стиль Steam</p>

            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(THEME_COLORS) as Array<ThemeColor>).map((c) => {
                const isActive = user.theme_color === c;
                const theme = THEME_COLORS[c];
                return (
                  <button
                    key={c}
                    onClick={() => setTheme(c)}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform ${isActive ? "scale-110" : "group-active:scale-95"}`}
                      style={{
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}80)`,
                        boxShadow: isActive
                          ? `0 0 0 2px #0e141d, 0 0 0 4px ${theme.primary}, 0 0 16px ${theme.glow}`
                          : `0 0 8px ${theme.glow}`,
                      }}
                    >
                      {isActive && <span className="text-[#0e141d] text-sm font-bold">✓</span>}
                    </div>
                    <span className={`text-[9px] font-medium text-center leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {theme.name.split(" ")[1] === "Classic" ? "Steam" : theme.name.split(" ")[1]}
                    </span>
                  </button>
                );
              })}
            </div>

            {themeError && (
              <p className="text-xs text-red-400 mt-2 text-center">{themeError}</p>
            )}
          </div>

          {/* Onboarding */}
          <button onClick={restartTour} className="room-card w-full flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Повторить обучение</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Интерактивный гайд по приложению</p>
            </div>
          </button>

          {/* About */}
          <div className="glass-card p-4">
            <h3 className="font-semibold text-sm mb-1">О приложении</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              StakApp v0.3 — LFG &amp; Voice Hub. Голосовые комнаты, поиск тимейтов и друзья
              прямо в Telegram Mini App.
            </p>
          </div>
        </TabsContent>

        {/* ── TAB: Reviews ── */}
        <TabsContent value="reviews" className="mt-4 space-y-3">
          {reviewsLoading ? (
            <div className="glass-card p-6 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-semibold">Отзывов пока нет</p>
              <p className="text-xs text-muted-foreground mt-1">
                Поиграй с кем-нибудь — после игры тимейты смогут оставить отзыв
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {reviews.map((review, idx) => {
                const info = REVIEW_TYPES[review.rating_type];
                const isNegative = review.rating_type === "toxic" || review.rating_type === "leaver";
                return (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="glass-card p-3 flex gap-3"
                  >
                    {review.from_user?.photo_url ? (
                      <img src={review.from_user.photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                        {review.from_user?.first_name?.[0] ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold truncate">
                          {review.from_user?.username ? `@${review.from_user.username}` : review.from_user?.first_name}
                        </p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            background: isNegative ? "rgba(218,48,48,0.15)" : "rgba(0,240,255,0.1)",
                            color: isNegative ? "#DA3030" : "var(--primary)",
                          }}
                        >
                          {info?.emoji} {info?.label}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-xs text-muted-foreground mt-1 italic">&laquo;{review.comment}&raquo;</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(review.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Friends shortcut */}
          <button
            onClick={() => router.push("/friends")}
            className="room-card w-full flex items-center gap-3 text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Друзья</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Список, заявки, личные сообщения</p>
            </div>
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
