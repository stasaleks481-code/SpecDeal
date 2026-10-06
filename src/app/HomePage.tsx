"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GamesTab } from "@/components/games/GamesTab";
import { useUser } from "@/lib/UserContext";
import type { UserRow } from "@/lib/supabase/client";
import { usePresence } from "@/lib/telegram/usePresence";

interface AuthResponse {
  user: UserRow | null;
  error?: string;
}

function HomePageContent() {
  const { user, loading, updateUser } = useUser();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const authenticate = useCallback(async () => {
    if (user) return;

    try {
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

      updateUser(data.user);
    } catch (err) {
      console.error("[auth] error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [user, updateUser]);

  useEffect(() => {
    if (!user) {
      authenticate();
    }
  }, [authenticate, user]);

  usePresence(user?.id ?? null);

  if (loading && !user) {
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

  if (error || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-300 mb-1">Ошибка входа</h2>
          <p className="text-sm text-muted-foreground mb-5">{error ?? "Unknown error"}</p>
          <button onClick={() => authenticate()} className="neon-btn text-sm w-full">
            Попробовать снова
          </button>
        </div>
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <GamesTab user={user} />
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
