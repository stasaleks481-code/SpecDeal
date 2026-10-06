"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GamesTab } from "@/components/games/GamesTab";
import { RoomsTab } from "@/components/rooms/RoomsTab";
import { ProfileView } from "@/components/profile/ProfileView";
import type { UserRow } from "@/lib/supabase/client";
import { usePresence } from "@/lib/telegram/usePresence";
import { motion, AnimatePresence } from "framer-motion";

interface AuthResponse {
  user: UserRow | null;
  error?: string;
}

function HomePageContent() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"games" | "rooms" | "profile">(
    tabParam === "rooms" ? "rooms" : tabParam === "profile" ? "profile" : "games"
  );

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

  // Clean up ?tab= param after applying
  useEffect(() => {
    if (tabParam) {
      router.replace("/");
    }
  }, [tabParam, router]);

  usePresence(user?.id ?? null);

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <div className="text-center">
            <p className="text-xl font-bold neon-text tracking-wide">StakApp</p>
            <p className="text-xs text-muted-foreground mt-1">Подключаемся...</p>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-300 mb-1">Ошибка входа</h2>
          <p className="text-sm text-muted-foreground mb-5">{error ?? "Unknown error"}</p>
          <button onClick={authenticate} className="neon-btn text-sm w-full">
            Попробовать снова
          </button>
        </div>
      </main>
    );
  }

  // Main UI — uses AppShell which provides header + bottom nav on every page
  return (
    <AppShell user={user}>
      <AnimatePresence mode="wait">
        {tab === "games" && (
          <motion.div
            key="games"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <GamesTab user={user} />
          </motion.div>
        )}
        {tab === "rooms" && (
          <motion.div
            key="rooms"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <RoomsTab user={user} />
          </motion.div>
        )}
        {tab === "profile" && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <ProfileView user={user} onUserUpdate={setUser} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden tab switcher — clicks from profile button go to /leaderboard now,
          so we only need games/rooms/profile here for direct navigation.
          Profile is reached via the avatar in the header. */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2">
        {tab !== "games" && (
          <button
            onClick={() => setTab("games")}
            className="hidden"
            aria-hidden
          />
        )}
      </div>
    </AppShell>
  );
}

export function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </main>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
