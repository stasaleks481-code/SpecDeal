"use client";

import { useEffect, useState, useCallback } from "react";
import { Gamepad2, MessageCircle, AlertTriangle, Home as HomeIcon } from "lucide-react";
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

  // Loading state — simple, performant
  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold neon-text tracking-wide">StakApp</p>
            <p className="text-xs text-muted-foreground mt-1">Подключаемся к хабу...</p>
          </div>
        </div>
      </main>
    );
  }

  // Error state — branded error card
  if (error || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
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
        </div>
      </main>
    );
  }

  // Main UI
  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header — sticky, no backdrop-blur (better perf) */}
      <header className="sticky top-0 z-20 bg-[#0e141d] border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--primary)" }}
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
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-colors ${
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

      {/* Tab content — no motion (lighter on mobile) */}
      <div className="flex-1 overflow-y-auto pb-24">
        {tab === "games" && <GamesTab user={user} />}
        {tab === "rooms" && <RoomsTab user={user} />}
        {tab === "profile" && <ProfileView user={user} onUserUpdate={setUser} />}
      </div>

      {/* Bottom navigation — fixed, simple bg (no blur) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0e141d] border-t border-border">
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
      className={`relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors ${
        active
          ? "text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <div>{icon}</div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
