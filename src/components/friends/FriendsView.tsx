"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search, UserPlus, Check, X, MessageCircle, Users, Clock,
} from "lucide-react";
import type { UserRow } from "@/lib/supabase/client";
import { OnlineDot } from "@/components/icons";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";

interface Friend {
  friendship_id: string;
  user: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    is_online: boolean;
    last_seen_at: string;
    trust_score: number;
  };
  since: string;
}

interface FriendRequest {
  request_id: string;
  from?: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    is_online: boolean;
    trust_score: number;
  };
  to?: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    is_online: boolean;
    trust_score: number;
  };
  created_at: string;
}

interface Props {
  user: UserRow;
}

export function FriendsView({ user: _user }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"friends" | "incoming" | "outgoing">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  }>>([]);

  // Native Telegram BackButton
  const goBack = useCallback(() => router.push("/"), [router]);
  useTelegramBackButton(goBack);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/friends", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends ?? []);
        setIncoming(data.incoming ?? []);
        setOutgoing(data.outgoing ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      // Use Supabase directly via REST API
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchQuery)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users ?? []);
      }
    } catch (err) {
      console.error("[search] error:", err);
    }
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(searchUsers, 300);
    return () => clearTimeout(t);
  }, [searchUsers]);

  const sendRequest = async (targetId: number) => {
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target_id: targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accepted) {
          // Was auto-accepted
          fetchData();
        } else {
          // Update outgoing list
          setSearchResults((prev) => prev.filter((u) => u.id !== targetId));
          fetchData();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to send request");
      }
    } catch (err) {
      console.error("[sendRequest] error:", err);
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("[accept] error:", err);
    }
  };

  const declineRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("[decline] error:", err);
    }
  };

  const openDM = (userId: number) => {
    router.push(`/dm/${userId}`);
  };

  const totalCount = friends.length + incoming.length + outgoing.length;

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-4">
      {/* Header — duotone hero */}
      <div className="vd-hero" style={{ background: "linear-gradient(135deg, #2f7cf6 0%, #22b8d4 100%)", "--hero-color": "#2f9df6" } as React.CSSProperties}>
        <div className="flex items-center gap-3.5">
          <div className="vd-tile w-12 h-12">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black leading-tight tracking-tight">Друзья</h1>
            <p className="text-xs text-white/75 mt-1 font-medium">
              {totalCount > 0 ? `${totalCount} контактов рядом` : "Найди тиммейтов и позови в голос"}
            </p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Найти по @username или имени..."
            className="vd-input !pl-10"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {searchResults.map((u) => (
              <div key={u.id} className="glass-card p-2.5 flex items-center gap-3">
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                    {u.first_name?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {u.username ? `@${u.username}` : u.first_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.first_name} {u.last_name}
                  </p>
                </div>
                <button
                  onClick={() => sendRequest(u.id)}
                  className="neon-btn !px-3 !py-1.5 text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                  Добавить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs — premium segmented control with red badges */}
      <div
        className="flex gap-1 p-1 rounded-2xl border border-border"
        style={{
          background: "rgba(255,255,255,0.035)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 20px -12px rgba(0,0,0,0.6)",
        }}
      >
        {([
          ["friends", "Друзья", friends.length],
          ["incoming", "Входящие", incoming.length],
          ["outgoing", "Отправленные", outgoing.length],
        ] as const).map(([id, label, count]) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                active ? "text-white" : "text-muted-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="friends-tab-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, #2f7cf6, #22b8d4)",
                    boxShadow: "0 6px 16px -6px rgba(47,157,246,0.55), 0 1px 0 rgba(255,255,255,0.3) inset",
                  }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {label}
                {count > 0 && <TabBadge count={count} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Загружаем...</p>
        </div>
      ) : activeTab === "friends" ? (
        friends.length === 0 ? (
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title="Пока нет друзей"
            subtitle="Найди тиммейтов через поиск выше"
          />
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.friendship_id} className="room-card p-3 flex items-center gap-3">
                <div className="relative">
                  {f.user.photo_url ? (
                    <img
                      src={f.user.photo_url}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover"
                      style={{
                        boxShadow: f.user.is_online
                          ? "0 0 0 2px rgba(63,185,80,0.55), 0 0 14px -2px rgba(63,185,80,0.5)"
                          : "0 0 0 2px rgba(255,255,255,0.08)",
                      }}
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                      {f.user.first_name?.[0] ?? "?"}
                    </div>
                  )}
                  {f.user.is_online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0b111a] shadow-[0_0_8px_rgba(63,185,80,0.8)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {f.user.username ? `@${f.user.username}` : f.user.first_name}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <OnlineDot online={f.user.is_online} />
                    {f.user.is_online ? "онлайн" : `был(а) ${formatLastSeen(f.user.last_seen_at)}`}
                  </p>
                </div>
                <button
                  onClick={() => openDM(f.user.id)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={{
                    background: "linear-gradient(140deg, rgba(47,124,246,0.22), rgba(123,92,240,0.12))",
                    border: "1px solid rgba(94,108,243,0.35)",
                    color: "#8db4ff",
                  }}
                  title="Написать"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : activeTab === "incoming" ? (
        incoming.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-7 h-7" />}
            title="Нет входящих заявок"
            subtitle="Когда кто-то добавит тебя, увидишь здесь"
          />
        ) : (
          <div className="space-y-2">
            {incoming.map((req) => req.from && (
              <div key={req.request_id} className="glass-card p-3 flex items-center gap-3">
                {req.from.photo_url ? (
                  <img src={req.from.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                    {req.from.first_name?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {req.from.username ? `@${req.from.username}` : req.from.first_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    хочет добавить тебя в друзья
                  </p>
                </div>
                <button
                  onClick={() => acceptRequest(req.request_id)}
                  className="p-2 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 transition-colors"
                  title="Принять"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => declineRequest(req.request_id)}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Отклонить"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        outgoing.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="w-7 h-7" />}
            title="Нет отправленных заявок"
            subtitle="Найди друзей через поиск"
          />
        ) : (
          <div className="space-y-2">
            {outgoing.map((req) => req.to && (
              <div key={req.request_id} className="glass-card p-3 flex items-center gap-3">
                {req.to.photo_url ? (
                  <img src={req.to.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                    {req.to.first_name?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {req.to.username ? `@${req.to.username}` : req.to.first_name}
                  </p>
                  <p className="text-xs text-muted-foreground">ожидает ответа</p>
                </div>
                <button
                  onClick={() => declineRequest(req.request_id)}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Отменить заявку"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/** Red circle badge — hidden when count is 0 (render-guarded by caller) */
function TabBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-[#DA3030] text-white text-[10px] font-bold leading-none shadow-[0_1px_4px_rgba(218,48,48,0.5)]"
      aria-label={`${count}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="glass-card p-8 text-center">
      <div
        className="w-16 h-16 vd-tile mx-auto mb-4"
        style={{ background: "linear-gradient(140deg, rgba(47,124,246,0.25), rgba(34,184,212,0.12))", borderColor: "rgba(47,157,246,0.3)" }}
      >
        {icon}
      </div>
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "только что";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}м назад`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}ч назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
