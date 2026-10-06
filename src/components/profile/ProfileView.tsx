"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Gamepad2, Star, Award, Users, ChevronRight,
  ShieldCheck, Sparkles, TrendingUp, MessageCircle,
} from "lucide-react";
import { THEME_COLORS, type UserRow } from "@/lib/supabase/client";

interface Props {
  user: UserRow;
  onUserUpdate: (u: UserRow) => void;
}

export function ProfileView({ user, onUserUpdate }: Props) {
  const [linking, setLinking] = useState(false);

  const setTheme = async (color: keyof typeof THEME_COLORS) => {
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_color: color }),
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdate(data.user);
        document.documentElement.setAttribute("data-accent", color);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const linkSteam = async () => {
    setLinking(true);
    setTimeout(() => {
      setLinking(false);
      alert("Steam интеграция скоро будет доступна 🚀");
    }, 1500);
  };

  const trustLevel = user.trust_score >= 50 ? "Высокий" : user.trust_score >= 20 ? "Средний" : "Низкий";
  const trustColor = user.trust_score >= 50 ? "#3FB950" : user.trust_score >= 20 ? "#F7A600" : "#DA3030";

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-5">
      {/* Profile header card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(0, 240, 255, 0.06) 0%, rgba(102, 192, 244, 0.04) 50%, rgba(27, 40, 56, 0.4) 100%)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: "var(--primary)" }} />

        <div className="relative flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name}
                className="w-20 h-20 rounded-2xl object-cover border-2"
                style={{
                  borderColor: "var(--primary)",
                  boxShadow: "0 0 20px color-mix(in srgb, var(--primary) 40%, transparent)",
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
                boxShadow: `0 0 8px ${trustColor}80`,
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
            <div className="flex items-center gap-2 mt-2">
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
                <span className="chip text-[10px]" style={{ background: "#1b2838", borderColor: "#66c0f440", color: "#66c0f4" }}>
                  <Gamepad2 className="w-3 h-3" /> Steam
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Badges */}
        {user.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {user.badges.includes("verified") && (
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-semibold"
                style={{ background: "#3FB95020", color: "#3FB950", border: "1px solid #3FB95040" }}
              >
                <ShieldCheck className="w-3 h-3" /> Steam Verified
              </span>
            )}
            {user.badges.includes("captain") && (
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-semibold"
                style={{ background: "#F7A60020", color: "#F7A600", border: "1px solid #F7A60040" }}
              >
                <Award className="w-3 h-3" /> Капитан
              </span>
            )}
            {user.badges.includes("adequate") && (
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-semibold"
                style={{ background: "#00A2FF20", color: "#00A2FF", border: "1px solid #00A2FF40" }}
              >
                ✓ Адекват
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="stat-block">
          <div className="stat-block__value">{user.matches_count}</div>
          <div className="stat-block__label">Матчей</div>
        </div>
        <div className="stat-block">
          <div className="stat-block__value">{user.reviews_count}</div>
          <div className="stat-block__label">Отзывов</div>
        </div>
        <div className="stat-block">
          <div className="stat-block__value">{user.trust_score}</div>
          <div className="stat-block__label">Рейтинг</div>
        </div>
      </motion.div>

      {/* Steam binding */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card overflow-hidden"
      >
        <button
          onClick={linkSteam}
          disabled={linking}
          className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors disabled:opacity-50 text-left"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #1b2838, #0e141d)",
              border: "1px solid #66c0f430",
            }}
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
      </motion.div>

      {/* Theme color picker */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Тема оформления</h3>
        </div>
        <div className="grid grid-cols-4 gap-3">
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
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}80)`,
                    boxShadow: isActive
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${theme.primary}, 0 0 24px ${theme.glow}`
                      : `0 0 12px ${theme.glow}`,
                  }}
                >
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-[#0e141d]"
                    >
                      ✓
                    </motion.div>
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {theme.name.split(" ")[1]}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Reviews shortcut */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card overflow-hidden"
      >
        <button className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left">
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
      </motion.div>

      {/* Friends shortcut */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card overflow-hidden"
      >
        <button className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Друзья</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Скоро: добавляй в друзья и пиши в ЛС
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </motion.div>

      {/* Match history shortcut */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <button className="w-full p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">История матчей</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.matches_count > 0
                ? `${user.matches_count} сыграно`
                : "Сыграй первую катку!"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center pt-4"
      >
        <p className="text-[10px] text-muted-foreground/50">
          StakApp v0.1 • сделано с ❤ для геймеров
        </p>
      </motion.div>
    </div>
  );
}
