"use client";

import { motion } from "framer-motion";
import { Users, Lock, Crown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RoomRow, UserRow } from "@/lib/supabase/client";
import { GAMES } from "@/lib/supabase/client";

interface Props {
  rooms: RoomRow[];
  currentUser: UserRow;
  onJoined: () => void;
}

export function GameRoomList({ rooms, currentUser }: Props) {
  const router = useRouter();

  const joinRoom = async (roomId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" });
      if (res.ok) {
        router.push(`/rooms/${roomId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to join");
      }
    } catch {
      alert("Network error");
    }
  };

  return (
    <div className="space-y-2.5">
      {rooms.map((room, idx) => {
        const game = GAMES.find((g) => g.code === room.game_name);
        const isHost = room.host_id === currentUser.id;
        return (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="room-card"
            style={{
              borderLeft: `3px solid ${game?.color ?? "var(--primary)"}`,
            }}
          >
            <div className="flex items-center gap-3">
              {/* Game logo block */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 relative overflow-hidden"
                style={{
                  background: game?.gradient ?? "rgba(102, 192, 244, 0.15)",
                  boxShadow: `0 4px 12px ${game?.color ?? "var(--primary)"}30`,
                }}
              >
                <span className="relative z-10 drop-shadow-lg">{game?.emoji ?? "🎮"}</span>
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.3), transparent 60%)",
                  }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm truncate">
                    {room.title}
                  </h3>
                  {isHost && (
                    <Crown className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" />
                  )}
                  {room.is_private && (
                    <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span
                    className="font-bold"
                    style={{ color: game?.color ?? "var(--primary)" }}
                  >
                    {game?.name ?? room.game_name}
                  </span>
                  {room.game_format && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="font-semibold">{room.game_format}</span>
                    </>
                  )}
                  {room.play_style && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="capitalize">{room.play_style}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => (isHost ? router.push(`/rooms/${room.id}`) : joinRoom(room.id))}
                className="neon-btn text-xs py-2 px-3 flex items-center gap-1 shrink-0"
              >
                <Users className="w-3.5 h-3.5" />
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
