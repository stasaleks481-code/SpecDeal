"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, MessageCircle, Moon, Mic, Crown } from "lucide-react";
import type { UserRow, RoomRow } from "@/lib/supabase/client";
import { CreateRoomModal } from "@/components/games/CreateRoomModal";

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

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: "casual" });
      const res = await fetch(`/api/rooms?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const isAnonymous = user.account_type === "anonymous";

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-5">
      {/* Hero (hidden when embedded in the HomeHub) */}
      {!embedded && (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-[#1b2838]/40">
        <div className="neon-strip" />
        <div className="p-4 flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--primary)" }}
          >
            <Moon className="w-5 h-5 text-[#0e141d]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold neon-text leading-tight">
              Голосовые комнаты
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Заходи в голос — просто поболтать, без цели
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Create CTA — big, friendly */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full rounded-2xl border border-dashed border-primary/35 p-5 flex items-center gap-3 text-left transition-colors hover:border-primary/60"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 50%, #1b2838))",
          }}
        >
          <Plus className="w-5 h-5 text-[#0e141d]" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Создать комнату общения</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Название не обязательно — всё готово за 5 секунд
          </p>
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
            onClick={fetchRooms}
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
          <div className="glass-card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold">Тишина...</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Создай первую комнату и позови людей
            </p>
            <button onClick={() => setShowCreate(true)} className="neon-btn text-xs">
              <Plus className="w-3 h-3 inline mr-1" />
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
                      {/* Voice icon bubble */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative"
                        style={{ background: "rgba(63, 185, 80, 0.12)", border: "1px solid rgba(63, 185, 80, 0.25)" }}
                      >
                        <Mic className="w-5 h-5 text-green-400" />
                        {memberCount > 1 && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse border-2 border-[#0e141d]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate flex items-center gap-1.5">
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

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <div className={`flex items-center gap-1 text-xs font-bold ${
                          isFull ? "text-red-400" : memberCount > 0 ? "text-green-400" : "text-muted-foreground"
                        }`}>
                          <Users className="w-3 h-3" />
                          {memberCount}/{room.max_players}
                        </div>
                        <span className="text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
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
