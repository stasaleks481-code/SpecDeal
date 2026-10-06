"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, Crown, Mic, Dices, Drama } from "lucide-react";
import { PARTY_GAMES, partyGame, type UserRow, type RoomRow } from "@/lib/supabase/client";
import { CreateRoomModal } from "@/components/games/CreateRoomModal";
import { PartyGameIcon } from "@/components/icons";
import { useRoomsRealtime } from "@/lib/useRoomsRealtime";
import { haptic } from "@/lib/telegram/haptics";

interface Props {
  user: UserRow;
}

/**
 * PartyTab — Table Games section: voice rooms with built-in game logic
 * (Spyfall, Mafia, Bunker, Who am I?) + create CTA.
 */
export function PartyTab({ user }: Props) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filterGame, setFilterGame] = useState<string | null>(null);

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ category: "party" });
      if (filterGame) params.set("game_type", filterGame);
      const res = await fetch(`/api/rooms?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms ?? []);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterGame]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Realtime: joins/leaves/closures from other clients refresh the list
  useRoomsRealtime(true, () => fetchRooms(true));

  const isAnonymous = user.account_type === "anonymous";

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-5">
      {/* Hero — party duotone */}
      <div className="vd-hero" style={{ background: "var(--grad-party)", "--hero-color": "#a855f7" } as React.CSSProperties}>
        <div className="flex items-center gap-3.5">
          <div className="vd-tile w-12 h-12">
            <Dices className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black leading-tight tracking-tight">Настольные игры</h1>
            <p className="text-xs text-white/75 mt-1 font-medium">
              Голос + встроенная логика: роли, карты и таймеры
            </p>
          </div>
        </div>
      </div>

      {/* Create CTA — gradient-bordered invitation */}
      <button
        onClick={() => {
          haptic.impact("medium");
          if (isAnonymous) {
            haptic.error();
            alert("Создавать комнаты можно после выбора основного типа аккаунта");
            return;
          }
          setShowCreate(true);
        }}
        className="w-full rounded-3xl p-[1px] text-left transition-transform active:scale-[0.985]"
        style={{
          background: "linear-gradient(120deg, rgba(168,85,247,0.65), rgba(236,72,153,0.45) 50%, rgba(255,255,255,0.06))",
        }}
      >
        <div
          className="rounded-[23px] p-4 flex items-center gap-3.5"
          style={{ background: "linear-gradient(180deg, rgba(22,32,46,0.96), rgba(15,22,33,0.98))" }}
        >
          <div
            className="vd-tile w-11 h-11"
            style={{
              background: "linear-gradient(140deg, #a855f7, #ec4899)",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 8px 20px -6px rgba(204,84,200,0.55)",
            }}
          >
            <Plus className="w-5 h-5" strokeWidth={2.75} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Собрать партию</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Выбери игру — роли и таймеры выдадутся автоматически
            </p>
          </div>
        </div>
      </button>

      {/* Game type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => {
            haptic.impact("light");
            setFilterGame(null);
          }}
          className={`chip shrink-0 ${filterGame === null ? "chip--active" : ""}`}
        >
          Все игры
        </button>
        {PARTY_GAMES.map((g) => (
          <button
            key={g.code}
            onClick={() => {
              haptic.impact("light");
              setFilterGame(g.code);
            }}
            className={`chip shrink-0 flex items-center gap-1.5 ${filterGame === g.code ? "chip--active" : ""}`}
            style={filterGame === g.code ? { background: g.color, borderColor: g.color } : {}}
          >
            <PartyGameIcon code={g.code} className="w-3.5 h-3.5" />
            {g.name}
          </button>
        ))}
      </div>

      {/* Rooms list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[76px] rounded-2xl bg-white/[0.03] border border-border animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="glass-card p-7 text-center">
          <div
            className="w-14 h-14 vd-tile mx-auto mb-4"
            style={{ background: "linear-gradient(140deg, rgba(168,85,247,0.3), rgba(236,72,153,0.18))", borderColor: "rgba(204,84,200,0.35)" }}
          >
            <Drama className="w-6 h-6 text-fuchsia-300" />
          </div>
          <p className="text-sm font-bold mb-1">Пока пусто</p>
          <p className="text-xs text-muted-foreground">
            {filterGame
              ? `Нет активных партий «${partyGame(filterGame)?.name}». Создай первую!`
              : "Никто ещё не собирает партию. Стань первым ведущим!"}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {rooms.map((room) => {
              const game = partyGame(room.game_type);
              const autoMute = room.game_settings?.auto_mute !== false;
              const memberCount = (room as RoomRow & { member_count?: number }).member_count ?? 0;
              return (
                <motion.button
                  key={room.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    haptic.impact("light");
                    router.push(`/rooms/${room.id}`);
                  }}
                  className="w-full room-card flex items-center gap-3 text-left"
                  style={game ? { borderLeft: `3px solid ${game.color}` } : undefined}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white"
                    style={{
                      background: game?.gradient ?? "rgba(255,255,255,0.06)",
                      boxShadow: game ? `0 8px 20px -6px ${game.color}70, 0 1px 0 rgba(255,255,255,0.25) inset` : undefined,
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    <PartyGameIcon code={game?.code} className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{room.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{
                          background: `${game?.color ?? "#666"}22`,
                          color: game?.color ?? "#aaa",
                          border: `1px solid ${game?.color ?? "#666"}44`,
                        }}
                      >
                        {game?.name ?? "Парти"}
                      </span>
                      {game?.code === "bunker" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1" style={{
                            background: autoMute ? "rgba(63,185,80,0.12)" : "rgba(255,255,255,0.06)",
                            color: autoMute ? "#3FB950" : "#888",
                          }}>
                            <Mic className="w-3 h-3" />
                            {autoMute ? "авто-мут" : "без мута"}
                          </span>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {memberCount}/{room.max_players}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {room.host_id === user.id && (
                      <Crown className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
                    )}
                    <Mic className="w-3.5 h-3.5 text-green-400" />
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateRoomModal
            user={user}
            defaultCategory="party"
            defaultGame={null}
            onClose={() => setShowCreate(false)}
            onCreated={(roomId) => {
              setShowCreate(false);
              router.push(`/rooms/${roomId}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
