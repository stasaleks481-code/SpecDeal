"use client";

import { useState, useEffect } from "react";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";
import type { UserRow } from "@/lib/supabase/client";

export default function LeaderboardPage() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: "" }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Not authenticated");
        const data = await res.json();
        setUser(data.user);
      })
      .catch(() => setShouldRedirect(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (shouldRedirect) window.location.href = "/";
  }, [shouldRedirect]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  return <LeaderboardView currentUser={user} />;
}
