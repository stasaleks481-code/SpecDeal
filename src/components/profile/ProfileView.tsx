"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, Star, Award, Users, ChevronRight } from "lucide-react";
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
    // Mock Steam binding — in real life, redirect to Steam OpenID
    setTimeout(() => {
      setLinking(false);
      alert("Steam integration — coming soon");
    }, 1500);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4">
      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary shadow-[0_0_12px_rgba(0,240,255,0.4)]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold neon-text">
                {user.first_name?.[0] ?? "?"}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[#0e141d]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">
              {user.first_name} {user.last_name}
            </h1>
            {user.username && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold">{user.trust_score}</span>
              <span className="text-xs text-muted-foreground">
                ({user.reviews_count} отзывов)
              </span>
            </div>
          </div>
        </div>

        {/* Badges */}
        {user.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {user.badges.includes("verified") && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 flex items-center gap-1">
                <Award className="w-3 h-3" /> Steam Верифицирован
              </span>
            )}
            {user.badges.includes("captain") && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-300">
                🎖️ Капитан
              </span>
            )}
            {user.badges.includes("adequate") && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/20 text-green-300">
                ✓ Адекват
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Матчей" value={user.matches_count} />
          <Stat label="Отзывов" value={user.reviews_count} />
          <Stat label="Рейтинг" value={user.trust_score} />
        </div>
      </motion.div>

      {/* Steam binding */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1b2838] flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-[#66c0f4]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Steam</h3>
            {user.steam_id ? (
              <p className="text-xs text-muted-foreground">
                Привязан: {user.steam_id}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Не привязан
              </p>
            )}
          </div>
          <button
            onClick={linkSteam}
            disabled={linking}
            className="neon-btn text-xs py-1.5 px-3 disabled:opacity-50"
          >
            {linking ? "..." : user.steam_id ? "Изменить" : "Привязать"}
          </button>
        </div>
      </motion.div>

      {/* Theme color picker */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-4"
      >
        <h3 className="font-semibold text-sm mb-3">Тема оформления</h3>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(THEME_COLORS) as Array<keyof typeof THEME_COLORS>).map((c) => {
            const isActive = user.theme_color === c;
            return (
              <button
                key={c}
                onClick={() => setTheme(c)}
                className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                  isActive ? "ring-2 ring-offset-2 ring-offset-[#0e141d]" : ""
                }`}
                style={{
                  background: THEME_COLORS[c].primary,
                  boxShadow: isActive
                    ? `0 0 12px ${THEME_COLORS[c].primary}, 0 0 24px ${THEME_COLORS[c].glow}`
                    : `0 0 6px ${THEME_COLORS[c].glow}`,
                  ...(isActive ? { "--tw-ring-color": THEME_COLORS[c].primary } : {}),
                }}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {THEME_COLORS[user.theme_color].name}
        </p>
      </motion.div>

      {/* Reviews about me */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Отзывы обо мне</h3>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        {user.reviews_count === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Пока нет отзывов. Поиграй с кем-нибудь!
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {user.reviews_count} отзывов — нажмите чтобы посмотреть
          </p>
        )}
      </motion.div>

      {/* Friends shortcut */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Друзья</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/40 rounded-lg p-2 text-center">
      <div className="text-lg font-bold neon-text">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
