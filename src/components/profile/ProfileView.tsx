"use client";

import { useState } from "react";
import {
  Gamepad2, Star, Users, ChevronRight,
  ShieldCheck, Sparkles, TrendingUp, Moon,
} from "lucide-react";
import { THEME_COLORS, type UserRow } from "@/lib/supabase/client";

interface Props {
  user: UserRow;
  onUserUpdate: (u: UserRow) => void;
}

export function ProfileView({ user, onUserUpdate }: Props) {
  const [linking, setLinking] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  const setTheme = async (color: keyof typeof THEME_COLORS) => {
    setThemeError(null);
    try {
      // Apply immediately for instant visual feedback (optimistic update)
      document.documentElement.setAttribute("data-accent", color);

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
    } catch (err) {
      console.error("[setTheme] error:", err);
      setThemeError(err instanceof Error ? err.message : "Failed");
      // Revert to previous theme on error
      document.documentElement.setAttribute("data-accent", user.theme_color);
    }
  };

  const linkSteam = async () => {
    setLinking(true);
    setTimeout(() => {
      setLinking(false);
      alert("Steam интеграция скоро будет доступна 🚀");
    }, 1500);
  };

  // Trust logic — neutral when user has no reviews yet
  const hasReviews = user.reviews_count > 0;
  const trustLevel = !hasReviews
    ? "Нейтрально"
    : user.trust_score >= 50
    ? "Высокий"
    : user.trust_score >= 20
    ? "Средний"
    : "Низкий";
  const trustColor = !hasReviews
    ? "#66c0f4"  // Steam blue — neutral
    : user.trust_score >= 50
    ? "#3FB950"
    : user.trust_score >= 20
    ? "#F7A600"
    : "#DA3030";

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-4">
      {/* Hero profile card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-[#1b2838]/40">
        {/* Neon strip at top */}
        <div className="neon-strip" />

        <div className="p-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              {user.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.first_name}
                  className="w-20 h-20 rounded-2xl object-cover border-2"
                  style={{
                    borderColor: "var(--primary)",
                  }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl font-bold neon-text border-2 border-primary">
                  {user.first_name?.[0] ?? "?"}
                </div>
              )}
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                style={{
                  background: trustColor,
                  borderColor: "#0e141d",
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#0e141d]" />
              </div>
            </div>

            {/* Name + handle */}
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
                  style={{
                    background: `${trustColor}20`,
                    color: trustColor,
                    border: `1px solid ${trustColor}40`,
                  }}
                >
                  {trustLevel} доверие
                </span>
                {user.steam_id && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                    style={{ background: "#1b2838", border: "1px solid #66c0f440", color: "#66c0f4" }}
                  >
                    <Gamepad2 className="w-3 h-3" /> Steam
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Badges row */}
          {user.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {user.badges.includes("verified") && (
                <span
                  className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-semibold"
                  style={{ background: "#3FB95020", color: "#3FB950", border: "1px solid #3FB95040" }}
                >
                  <ShieldCheck className="w-3 h-3" /> Steam Verified
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
                  ✓ Адекват
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
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

      {/* Action list — clean rows with neon divider */}
      <div className="glass-card overflow-hidden">
        {/* Steam binding */}
        <button
          onClick={linkSteam}
          disabled={linking}
          className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors disabled:opacity-50 text-left border-b border-border"
        >
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
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#3FB95020", color: "#3FB950" }}>
                  подключён
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.steam_id ? `ID: ${user.steam_id}` : "Привяжи для бейджа верификации"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {/* Reviews */}
        <button className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left border-b border-border">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-primary" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Отзывы обо мне</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.reviews_count > 0
                ? `${user.reviews_count} отзыв(ов)`
                : "Поиграй с кем-нибудь, чтобы получить отзывы"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {/* Friends */}
        <button className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left border-b border-border">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Друзья</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Скоро: добавляй в друзья и пиши в ЛС</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {/* Match history */}
        <button className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">История матчей</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.matches_count > 0 ? `${user.matches_count} сыграно` : "Сыграй первую катку!"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </div>

      {/* Theme picker */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Тема оформления</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Выбери цвет акцента — изменится вся подсветка</p>

        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(THEME_COLORS) as Array<keyof typeof THEME_COLORS>).map((c) => {
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
                <span className={`text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {theme.name.split(" ")[1]}
                </span>
              </button>
            );
          })}
        </div>

        {themeError && (
          <p className="text-xs text-red-400 mt-2 text-center">⚠ {themeError}</p>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-[10px] text-muted-foreground/50">
          StakApp v0.2 • сделано с ❤ для геймеров
        </p>
      </div>
    </div>
  );
}
