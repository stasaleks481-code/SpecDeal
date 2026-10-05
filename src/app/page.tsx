"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, MessageSquare, Loader2, AlertTriangle } from "lucide-react";
import { GamesTab } from "@/components/games/GamesTab";
import { RoomsTab } from "@/components/rooms/RoomsTab";
import { ProfileView } from "@/components/profile/ProfileView";
import type { UserRow } from "@/lib/supabase/client";

type Tab = "games" | "rooms" | "profile";

interface AuthResponse {
  user: UserRow | null;
  error?: string;
}

export default function Home() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("games");

  // Auth flow: send Telegram initData to /api/auth, get back user
  const authenticate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get initData from Telegram WebApp SDK
      let initData = "";
      if (typeof window !== "undefined") {
        // Telegram WebApp passes initData via window.Telegram.WebApp.initData
        const tg = (window as unknown as { Telegram?: { WebApp?: { initData: string } } }).Telegram;
        if (tg?.WebApp?.initData) {
          initData = tg.WebApp.initData;
          // Inform Telegram that the WebApp is ready
          tg.WebApp.ready();
          tg.WebApp.expand();
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

      // Apply theme color to <html data-accent="...">
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

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-cyan-400/40 rounded-full" />
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 relative z-10" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold neon-text">StakApp</p>
            <p className="text-xs text-muted-foreground mt-1">Connecting to hub...</p>
          </div>
        </motion.div>
      </main>
    );
  }

  // Error state
  if (error || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-6 max-w-sm w-full text-center"
        >
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-300 mb-1">Auth failed</h2>
          <p className="text-sm text-muted-foreground mb-4">{error ?? "Unknown error"}</p>
          <button
            onClick={authenticate}
            className="neon-btn text-sm"
          >
            Retry
          </button>
        </motion.div>
      </main>
    );
  }

  // Main UI — bottom nav + content
  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border backdrop-blur-md sticky top-0 z-10 bg-[#0e141d]/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.5)]">
            <span className="text-xs font-bold text-[#0e141d]">SA</span>
          </div>
          <span className="font-semibold neon-text text-lg">StakApp</span>
        </div>
        <button
          onClick={() => setTab("profile")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-card hover:border-cyan-400/40 transition-colors"
        >
          {user.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photo_url}
              alt={user.first_name}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-cyan-400/20 flex items-center justify-center text-xs">
              {user.first_name?.[0] ?? "?"}
            </div>
          )}
          <span className="text-sm font-medium max-w-[100px] truncate">
            {user.username ? `@${user.username}` : user.first_name}
          </span>
        </button>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          {tab === "games" && (
            <motion.div
              key="games"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <GamesTab user={user} />
            </motion.div>
          )}
          {tab === "rooms" && (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <RoomsTab user={user} />
            </motion.div>
          )}
          {tab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <ProfileView user={user} onUserUpdate={setUser} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-[#0e141d]/95 backdrop-blur-md border-t border-border">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-1 px-2 py-2 safe-area-inset-bottom">
          <TabButton
            active={tab === "games"}
            onClick={() => setTab("games")}
            icon={<Gamepad2 className="w-5 h-5" />}
            label="Игры"
          />
          <TabButton
            active={tab === "rooms"}
            onClick={() => setTab("rooms")}
            icon={<MessageSquare className="w-5 h-5" />}
            label="Чилл"
          />
          <TabButton
            active={tab === "profile"}
            onClick={() => setTab("profile")}
            icon={
              user.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photo_url}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] font-bold">
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
      className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-all ${
        active
          ? "text-primary bg-primary/10 shadow-[0_0_8px_rgba(0,240,255,0.3)]"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
