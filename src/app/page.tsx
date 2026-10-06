"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, MessageCircle, Loader2, AlertTriangle, Home as HomeIcon } from "lucide-react";
import { GamesTab } from "@/components/games/GamesTab";
import { RoomsTab } from "@/components/rooms/RoomsTab";
import { ProfileView } from "@/components/profile/ProfileView";
import type { UserRow } from "@/lib/supabase/client";

type Tab = "games" | "rooms" | "profile";

interface AuthResponse {
  user: UserRow | null;
  error?: string;
}

export default function HomePage() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("games");

  const authenticate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let initData = "";
      if (typeof window !== "undefined") {
        for (let i = 0; i < 30; i++) {
          const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
          if (tg?.WebApp && typeof tg.WebApp.initData === "string") {
            initData = tg.WebApp.initData;
            tg.WebApp.ready();
            tg.WebApp.expand();
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!initData) {
          const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
          if (tg?.WebApp?.initData) {
            initData = tg.WebApp.initData;
            tg.WebApp.ready();
            tg.WebApp.expand();
          }
        }
      }

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data: AuthResponse = await res.json();
      if (!data.user) {
        throw new Error(data.error ?? "No user in response");
      }

      setUser(data.user);
      if (data.user.theme_color) {
        document.documentElement.setAttribute("data-accent", data.user.theme_color);
      }
    } catch (err) {
      console.error("[auth] error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  // Loading state — branded spinner
  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-5"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary"
              style={{ boxShadow: "0 0 20px color-mix(in srgb, var(--primary) 40%, transparent)" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold neon-text tracking-wide">StakApp</p>
            <p className="text-xs text-muted-foreground mt-1">Подключаемся к хабу...</p>
          </div>
        </motion.div>
      </main>
    );
  }

  // Error state — branded error card
  if (error || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="glass-card p-6 max-w-sm w-full text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-300 mb-1">Ошибка входа</h2>
          <p className="text-sm text-muted-foreground mb-5">{error ?? "Unknown error"}</p>
          <button
            onClick={authenticate}
            className="neon-btn text-sm w-full"
          >
            Попробовать снова
          </button>
        </motion.div>
      </main>
    );
  }

  // Main UI
  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header — minimal, sticky */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[#0e141d]/85 border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 50%, #1b2838))",
                boxShadow: "0 0 14px color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
            >
              <HomeIcon className="w-4 h-4 text-[#0e141d]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-base font-bold neon-text leading-tight">StakApp</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">
                {tab === "games" ? "LFG Hub" : tab === "rooms" ? "Chill Zone" : "Profile"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setTab("profile")}
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all ${
              tab === "profile"
                ? "border-primary/40 bg-primary/10"
                : "border-border hover:border-primary/30"
            }`}
          >
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                {user.first_name?.[0] ?? "?"}
              </div>
            )}
            <span className="text-xs font-semibold max-w-[80px] truncate">
              {user.username ? user.username : user.first_name}
            </span>
          </button>
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {tab === "games" && (
            <motion.div
              key="games"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <GamesTab user={user} />
            </motion.div>
          )}
          {tab === "rooms" && (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
            >
              <RoomsTab user={user} />
            </motion.div>
          )}
          {tab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
            >
              <ProfileView user={user} onUserUpdate={setUser} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom navigation — fixed, glassmorphic */}
      <nav className="fixed bottom-0 left-0 right-0 z-30">
        <div className="backdrop-blur-xl bg-[#0e141d]/90 border-t border-border">
          <div className="max-w-md mx-auto grid grid-cols-3 gap-1 px-3 py-2 safe-area-inset-bottom">
            <TabButton
              active={tab === "games"}
              onClick={() => setTab("games")}
              icon={<Gamepad2 className="w-5 h-5" />}
              label="Игры"
            />
            <TabButton
              active={tab === "rooms"}
              onClick={() => setTab("rooms")}
              icon={<MessageCircle className="w-5 h-5" />}
              label="Чилл"
            />
            <TabButton
              active={tab === "profile"}
              onClick={() => setTab("profile")}
              icon={
                user.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                    {user.first_name?.[0] ?? "?"}
                  </div>
                )
              }
              label="Профиль"
            />
          </div>
        </div>
      </nav>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all ${
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 rounded-xl bg-primary/10"
          style={{ boxShadow: "0 0 12px color-mix(in srgb, var(--primary) 30%, transparent)" }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
        />
      )}
      <div className="relative z-10">{icon}</div>
      <span className="relative z-10 text-[10px] font-semibold">{label}</span>
    </button>
  );
}
