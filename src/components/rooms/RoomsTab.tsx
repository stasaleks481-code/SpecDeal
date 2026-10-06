"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, MessageCircle, Moon, Mic, Crown } from "lucide-react";
import type { UserRow, RoomRow } from "@/lib/supabase/client";
import { CreateRoomModal } from "@/components/games/CreateRoomModal";
import { useRoomsRealtime } from "@/lib/useRoomsRealtime";

interface Props {
  user: UserRow;
  /** When true — rendered inside HomeHub (hero card is hidden) */
  embedded?: boolean;
}

/**
 * RoomsTab — general (casual) voice rooms list.
 * Redesigned: clean modern cards, no topic filters (topics removed
 * from creation flow), voice-first affordances.
 */
export function RoomsTab({ user, embedded = false }: Props) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ category: "casual" });
      const res = await fetch(`/api/rooms?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms ?? []);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Realtime: joins/leaves/closures from other clients refresh the list
  useRoomsRealtime(true, () => fetchRooms(true));

  const isAnonymous = user.account_type === "anonymous";

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-5">
      {/* Hero (hidden when embedded in the HomeHub) */}
      {!embedded && (
      <div className="vd-hero" style={{ background: "var(--grad-vocal)", "--hero-color": "#2f7cf6" } as React.CSSProperties}>
        <div className="flex items-center gap-3.5">
          <div className="vd-tile w-12 h-12">
            <Moon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black leading-tight tracking-tight">
              Голосовые комнаты
            </h1>
            <p className="text-xs text-white/75 mt-1 font-medium">
              Заходи в голос — просто поболтать, без цели
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Create CTA — premium gradient-bordered invitation */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full rounded-3xl p-[1px] text-left transition-transform active:scale-[0.985]"
        style={{
          background: "linear-gradient(120deg, color-mix(in srgb, var(--primary) 55%, transparent), rgba(123,92,240,0.4) 45%, rgba(255,255,255,0.06))",
        }}
      >
        <div
          className="rounded-[23px] p-4 flex items-center gap-3.5"
          style={{ background: "linear-gradient(180deg, rgba(22,32,46,0.96), rgba(15,22,33,0.98))" }}
        >
          <div
            className="vd-tile w-11 h-11"
            style={{
              background: "linear-gradient(140deg, #2f7cf6, #7b5cf0)",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 8px 20px -6px rgba(94,108,243,0.55)",
            }}
          >
            <Plus className="w-5 h-5" strokeWidth={2.75} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Создать комнату общения</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Название не обязательно — всё готово за 5 секунд
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white" style={{ background: "linear-gradient(135deg, #2f7cf6, #7b5cf0)" }}>
            NEW
          </span>
        </div>
      </button>

      {/* Rooms list */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="section-label">Сейчас в голосе</span>
            {rooms.length > 0 && (
              <span className="text-xs text-muted-foreground">({rooms.length})</span>
            )}
          </div>
          <button
            onClick={() => fetchRooms()}
            className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="room-card animate-pulse" style={{ opacity: 0.4 }}>
                <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
                <div className="h-3 bg-white/5 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="glass-card p-7 text-center">
            <div
              className="w-14 h-14 vd-tile mx-auto mb-4"
              style={{ background: "linear-gradient(140deg, rgba(47,124,246,0.3), rgba(123,92,240,0.2))", borderColor: "rgba(94,108,243,0.35)" }}
            >
              <MessageCircle className="w-6 h-6 text-[#7ba6ff]" />
            </div>
            <p className="text-sm font-bold">Тишина...</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Создай первую комнату и позови людей
            </p>
            <button onClick={() => setShowCreate(true)} className="neon-btn text-xs">
              <Plus className="w-3 h-3" />
              Создать комнату
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {rooms.map((room, idx) => {
                const memberCount = (room as RoomRow & { member_count?: number }).member_count ?? 0;
                const isFull = memberCount >= room.max_players;
                const host = (room as RoomRow & { host?: { photo_url?: string; first_name?: string; id?: number } }).host;
                const live = memberCount > 0;
                return (
                  <motion.button
                    key={room.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => router.push(`/rooms/${room.id}`)}
                    className="room-card w-full text-left group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Voice icon bubble — live glow */}
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
                        style={{
                          background: live
                            ? "linear-gradient(140deg, rgba(63,185,80,0.22), rgba(34,197,94,0.08))"
                            : "rgba(255,255,255,0.05)",
                          border: live ? "1px solid rgba(63,185,80,0.4)" : "1px solid var(--border)",
                          boxShadow: live ? "0 0 18px -4px rgba(63,185,80,0.45)" : undefined,
                        }}
                      >
                        <Mic className={`w-5 h-5 ${live ? "text-green-400" : "text-muted-foreground"}`} />
                        {memberCount > 1 && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse border-2 border-[#0b111a]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate flex items-center gap-1.5">
                          {room.title}
                          {host?.id === user.id && (
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" />
                          )}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {host?.photo_url ? (
                            <img src={host.photo_url} alt="" className="w-4 h-4 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                              {host?.first_name?.[0] ?? "?"}
                            </div>
                          )}
                          <span className="text-[11px] text-muted-foreground truncate">
                            {host?.first_name ?? "Хост"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(room.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <div className={`flex items-center gap-1 text-xs font-black ${
                          isFull ? "text-red-400" : live ? "text-green-400" : "text-muted-foreground"
                        }`}>
                          <Users className="w-3 h-3" />
                          {memberCount}/{room.max_players}
                        </div>
                        <span
                          className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full transition-opacity"
                          style={{
                            background: live ? "rgba(63,185,80,0.15)" : "rgba(255,255,255,0.06)",
                            color: live ? "#4ade80" : "var(--muted-foreground)",
                          }}
                        >
                          Войти →
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRoomModal
          user={user}
          defaultCategory="casual"
          defaultGame={null}
          onClose={() => setShowCreate(false)}
          onCreated={(roomId) => {
            setShowCreate(false);
            window.location.href = `/rooms/${roomId}`;
          }}
        />
      )}
    </div>
  );
}
