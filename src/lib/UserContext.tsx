"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserRow } from "@/lib/supabase/client";

interface UserContextValue {
  user: UserRow | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateUser: (u: UserRow) => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  updateUser: () => {},
});

const USER_CACHE_KEY = "stakapp_user_cache";

/**
 * UserProvider — caches the current user in:
 *   1. React state (in-memory for the session)
 *   2. localStorage (so page refreshes don't show a loading spinner)
 *
 * On mount:
 *   - Reads cached user from localStorage → sets state instantly (no loading)
 *   - Then fetches /api/me in the background to verify & refresh
 *   - If /api/me fails AND we have a cache → keep cache (stale but visible)
 *   - If /api/me fails AND no cache → redirect to / for re-auth
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load: read from localStorage cache (instant, no API call)
  // The HomePage component handles the initial /api/auth flow and calls
  // updateUser() which populates both state and localStorage.
  // Sub-pages just read from localStorage here — no loading spinner.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let parsed: UserRow | null = null;

    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          parsed = JSON.parse(cached) as UserRow;
        }
      } catch {
        // ignore parse errors
      }
    }

    if (parsed) {
      setUser(parsed);
      setLoading(false);
      if (parsed.theme_color) {
        document.documentElement.setAttribute("data-accent", parsed.theme_color);
      }
    } else {
      // No cache — if not on /, redirect for auth
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      } else {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    // Force refresh from API (bypass cache)
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (typeof window !== "undefined") {
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
          }
          if (data.user.theme_color) {
            document.documentElement.setAttribute("data-accent", data.user.theme_color);
          }
        }
      }
    } catch (err) {
      console.error("[refresh] error:", err);
    }
  }, []);

  const updateUser = useCallback((u: UserRow) => {
    setUser(u);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    }
    if (u.theme_color) {
      document.documentElement.setAttribute("data-accent", u.theme_color);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error, refresh, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
