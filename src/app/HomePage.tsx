"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GamesTab } from "@/components/games/GamesTab";
import { OnboardingTour, type TourStep } from "@/components/onboarding/OnboardingTour";
import { useUser } from "@/lib/UserContext";
import type { UserRow } from "@/lib/supabase/client";
import { usePresence } from "@/lib/telegram/usePresence";

const TOUR_DONE_KEY = "stakapp_tour_done_v1";

/** Interactive onboarding steps — targets use data-tour attributes */
const TOUR_STEPS: TourStep[] = [
  {
    targetId: "games-grid",
    title: "Игры и лобби",
    description: "Выбирай игру — внутри список активных лобби, где ты можешь присоединиться к тимейтам.",
    position: "bottom",
  },
  {
    targetId: "nav-create",
    title: "Создать комнату",
    description: "Жми плюс, чтобы создать своё лобби: голосовая связь включается автоматически.",
    position: "top",
  },
  {
    targetId: "nav-chill",
    title: "Chill-комнаты",
    description: "Здесь общие голосовые комнаты — зайди поболтать на любую тему.",
    position: "top",
  },
  {
    targetId: "nav-friends",
    title: "Друзья и сообщения",
    description: "Заявки в друзья, список друзей и личные сообщения — всё здесь.",
    position: "top",
  },
  {
    targetId: "nav-profile",
    title: "Твой профиль",
    description: "Статистика, отзывы, привязка Steam и настройки тем оформления.",
    position: "top",
  },
];

interface AuthResponse {
  user: UserRow | null;
  error?: string;
}

function HomePageContent() {
  const { user, loading, updateUser } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [steamNotice, setSteamNotice] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    if (user) return;

    try {
      setError(null);

      // Wait for Telegram WebApp SDK (up to 3s), collect initData
      let initData = "";
      if (typeof window !== "undefined") {
        for (let i = 0; i < 30; i++) {
          const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
          if (tg?.WebApp && typeof tg.WebApp.initData === "string" && tg.WebApp.initData.length > 0) {
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

        // Handle Steam OAuth return flags
        const params = new URLSearchParams(window.location.search);
        if (params.has("steam_login")) {
          setSteamNotice("Steam-аккаунт подключён — добро пожаловать!");
          window.history.replaceState({}, "", "/");
        } else if (params.has("steam_linked")) {
          setSteamNotice("Steam успешно привязан к аккаунту");
          window.history.replaceState({}, "", "/");
        } else if (params.has("steam_error")) {
          setSteamNotice("Не удалось войти через Steam. Попробуй ещё раз.");
          window.history.replaceState({}, "", "/");
        }
      }

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

  // Launch interactive onboarding tour for new users
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const tourDone = localStorage.getItem(TOUR_DONE_KEY) === "1" || user.onboarding_done;
    if (!tourDone && user.account_type !== "anonymous") {
      const t = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  usePresence(user?.id ?? null);

  const completeTour = useCallback(() => {
    setShowTour(false);
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch { /* ignore */ }
    fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ onboarding_done: true }),
    }).catch(() => {});
  }, []);

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

  if (error && !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-300 mb-1">Ошибка входа</h2>
          <p className="text-sm text-muted-foreground mb-5">{error}</p>
          <div className="space-y-2">
            <button onClick={() => authenticate()} className="neon-btn text-sm w-full">
              Попробовать снова
            </button>
            <button
              onClick={async () => {
                setError(null);
                try {
                  const res = await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ anonymous: true }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.user) throw new Error(data.error ?? "Ошибка");
                  updateUser(data.user);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Ошибка");
                }
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              Войти анонимно
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const isAnonymous = user.account_type === "anonymous";

  return (
    <>
      <AppShell user={user}>
        <GamesTab user={user} />
      </AppShell>

      {/* Steam OAuth result notice */}
      {steamNotice && !isAnonymous && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-xl text-xs font-semibold neon-text"
          style={{
            background: "rgba(20, 27, 38, 0.95)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
          onClick={() => setSteamNotice(null)}
        >
          {steamNotice}
        </div>
      )}

      {/* Interactive onboarding tour */}
      {showTour && !isAnonymous && (
        <OnboardingTour steps={TOUR_STEPS} onComplete={completeTour} />
      )}
    </>
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
