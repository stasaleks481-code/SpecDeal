"use client";

import { Users, Lock, Crown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RoomRow, UserRow } from "@/lib/supabase/client";
import { GAMES, SKILL_LEVELS, type SkillLevel } from "@/lib/supabase/client";

interface HostInfo {
  id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

interface RoomWithMeta extends RoomRow {
  host?: HostInfo;
  member_count?: number;
}

interface Props {
  rooms: RoomWithMeta[];
  currentUser: UserRow;
  onJoined: () => void;
}

export function GameRoomList({ rooms, currentUser }: Props) {
  const router = useRouter();

  const openRoom = (roomId: string) => {
    router.push(`/rooms/${roomId}`);
  };

  return (
    <div className="space-y-2.5">
      {rooms.map((room) => {
        const game = GAMES.find((g) => g.code === room.game_name);
        const isHost = room.host_id === currentUser.id;
        const memberCount = room.member_count ?? 0;
        const isFull = memberCount >= room.max_players;
        const host = room.host;

        return (
          <button
            key={room.id}
            onClick={() => openRoom(room.id)}
            className="room-card w-full text-left"
            style={{
              borderLeft: `3px solid ${game?.color ?? "var(--primary)"}`,
              boxShadow: game ? `inset 3px 0 12px -6px ${game.color}55` : undefined,
            }}
          >
            <div className="flex items-center gap-3">
              {/* Game icon — gradient squircle with glow */}
              <div
                className="relative w-12 h-12 rounded-2xl overflow-hidden shrink-0"
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: game ? `0 6px 16px -6px ${game.color}60` : undefined,
                }}
              >
                {game?.banner ? (
                  <img
                    src={game.banner}
                    alt={game.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-sm font-black"
                    style={{
                      background: game?.gradient ?? "rgba(102, 192, 244, 0.15)",
                      color: game?.color ?? "var(--primary)",
                    }}
                  >
                    {game?.name?.[0] ?? "?"}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm truncate">{room.title}</h3>
                  {isHost && (
                    <Crown className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" />
                  )}
                  {room.is_private && (
                    <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="font-bold" style={{ color: game?.color ?? "var(--primary)" }}>
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
                  {room.skill_level && SKILL_LEVELS[room.skill_level as SkillLevel] && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide"
                      style={{
                        background: `${SKILL_LEVELS[room.skill_level as SkillLevel].color}1E`,
                        color: SKILL_LEVELS[room.skill_level as SkillLevel].color,
                        border: `1px solid ${SKILL_LEVELS[room.skill_level as SkillLevel].color}44`,
                      }}
                    >
                      {SKILL_LEVELS[room.skill_level as SkillLevel].short}
                    </span>
                  )}
                </div>
              </div>

              {/* Host avatar + member count */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-1">
                  {host?.photo_url ? (
                    <img src={host.photo_url} alt="" className="w-5 h-5 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold">
                      {host?.first_name?.[0] ?? "?"}
                    </div>
                  )}
                </div>
                <div className={`flex items-center gap-0.5 text-xs font-black ${
                  isFull ? "text-red-400" : "text-muted-foreground"
                }`}>
                  <Users className="w-3 h-3" />
                  {memberCount}/{room.max_players}
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
