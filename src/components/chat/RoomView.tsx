"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Crown, Mic, MicOff, PhoneOff, Users, LogOut,
  MessageSquare, Volume2, VolumeX, ShieldAlert, Lock, UserMinus, ChevronDown, X,
  Dices, PhoneIncoming,
} from "lucide-react";
import { GAMES, SKILL_LEVELS, partyGame, type SkillLevel } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";
import type { UserRow } from "@/lib/supabase/client";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";
import { haptic } from "@/lib/telegram/haptics";
import { useVoiceCall } from "@/lib/webrtc/useVoiceCall";
import { GamePanel } from "@/components/party/GamePanel";

interface RoomData {
  id: string;
  host_id: number;
  category: "game" | "casual" | "party";
  game_name: string | null;
  game_format: string | null;
  play_style: string | null;
  topic_tags: string[];
  skill_level: SkillLevel | null;
  game_type: string | null;
  game_settings: { auto_mute?: boolean } | null;
  title: string;
  max_players: number;
  is_active: boolean;
  voice_enabled: boolean;
}

interface Member {
  user_id: number;
  is_ready: boolean;
  joined_at: string;
  user: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  };
}

interface ChatMessage {
  id: number;
  content: string;
  created_at: string;
  sender: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  };
}

/** Mini profile card shown when tapping a participant */
interface ProfileCardData {
  userId: number;
  firstName: string;
  username: string | null;
  photoUrl: string | null;
  trustScore?: number;
  isHost: boolean;
}

interface Props {
  user: UserRow;
}

/**
 * RoomView — Voice-first (Discord-style) room.
 * Voice channel is the base; text chat is a collapsible bottom sheet.
 */
export function RoomView({ user }: Props) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile card popup
  const [profileCard, setProfileCard] = useState<ProfileCardData | null>(null);

  const isAnonymous = user.account_type === "anonymous";

  // Voice call — the mic is requested ONLY when the user taps
  // "Join voice" below (never on open / tab switches)
  const voiceCall = useVoiceCall({
    roomId,
    userId: user.id,
    isHost: room?.host_id === user.id, // known by the time the user taps Join
    userInfo: {
      username: user.username,
      firstName: user.first_name,
      photoUrl: user.photo_url,
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const goBack = useCallback(() => router.push("/"), [router]);
  useTelegramBackButton(goBack);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRoom(data.room);
      setMembers(data.members ?? []);

      const isMember = (data.members ?? []).some((m: Member) => m.user_id === user.id);
      if (!isMember && data.room.host_id !== user.id && !isAnonymous) {
        const joinRes = await fetch(`/api/rooms/${roomId}/join`, { method: "POST", credentials: "include" });
        if (!joinRes.ok) {
          const jdata = await joinRes.json().catch(() => ({}));
          throw new Error(jdata.error ?? "Failed to join");
        }
        const refetch = await fetch(`/api/rooms/${roomId}`, { credentials: "include" });
        if (refetch.ok) {
          const rdata = await refetch.json();
          setMembers(rdata.members ?? []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [roomId, user.id, isAnonymous]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch (err) {
      console.error("[messages] fetch error:", err);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    fetchMessages();
  }, [fetchRoom, fetchMessages]);

  // Realtime: new messages + member changes
  useEffect(() => {
    if (!room) return;

    const msgChannel = supabase
      .channel(`room_messages_${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as { id: number; content: string; created_at: string; sender_id: number };
          const { data: sender } = await supabase
            .from("users")
            .select("id, username, first_name, last_name, photo_url")
            .eq("id", newMsg.sender_id)
            .maybeSingle();
          setMessages((prev) => [...prev, { ...newMsg, sender: sender ?? { id: newMsg.sender_id, username: null, first_name: "?", last_name: null, photo_url: null } }]);
        }
      )
      .subscribe();

    const memberChannel = supabase
      .channel(`room_members_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        async () => {
          const res = await fetch(`/api/rooms/${roomId}`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            setMembers(data.members ?? []);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [room, roomId]);

  useEffect(() => {
    if (showChat && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showChat]);

  // Deafen: mute ALL remote audio elements
  useEffect(() => {
    document.querySelectorAll("audio").forEach((a) => {
      a.muted = deafened;
    });
  }, [deafened]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content) return;
    setInput("");
    inputRef.current?.focus();
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        haptic.error();
        alert(data.error ?? "Failed to send");
        setInput(content);
      } else {
        haptic.impact("light");
      }
    } catch {
      haptic.error();
      setInput(content);
    }
  };

  const leaveRoom = async () => {
    if (!confirm("Выйти из комнаты?")) return;
    try {
      await fetch(`/api/rooms/${roomId}/leave`, { method: "POST", credentials: "include" });
      router.push("/");
    } catch (err) {
      console.error("[leave] error:", err);
    }
  };

  // Kicked by host — full-screen notice
  if (voiceCall.kicked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-300 mb-1">Вас исключили из комнаты</h2>
          <p className="text-sm text-muted-foreground mb-5">Хост завершил ваше участие в этом лобби</p>
          <button onClick={() => router.push("/")} className="neon-btn text-sm w-full">
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Загружаем комнату...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <p className="text-sm font-semibold mb-2">Комната не найдена</p>
          <p className="text-xs text-muted-foreground mb-4">{error ?? "Unknown error"}</p>
          <button onClick={() => router.push("/")} className="neon-btn text-xs w-full">
            На главную
          </button>
        </div>
      </div>
    );
  }

  const game = room.game_name ? GAMES.find((g) => g.code === room.game_name) : null;
  const partyDef = room.category === "party" ? partyGame(room.game_type) : null;
  const skillMeta = room.category === "game" && room.skill_level
    ? SKILL_LEVELS[room.skill_level as SkillLevel] ?? null
    : null;
  const isHost = room.host_id === user.id;
  const memberCount = members.length;
  const notInCall = members.filter((m) => !voiceCall.participants.some((p) => p.userId === m.user_id));

  const openProfileCard = async (userId: number, firstName: string, username: string | null, photoUrl: string | null, participantIsHost: boolean) => {
    haptic.impact("light");
    setProfileCard({ userId, firstName, username, photoUrl, isHost: participantIsHost });
    // Enrich with trust score (fire and forget)
    if (userId !== user.id) {
      try {
        const res = await fetch(`/api/users/${userId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setProfileCard((prev) => (prev && prev.userId === userId ? { ...prev, trustScore: data.user?.trust_score } : prev));
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="flex flex-col h-screen relative">
      {/* Header */}
      <header className="bg-[#0e141d] border-b border-border z-20">
        <div className="neon-strip" />
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {game && (
            <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0">
              {game.banner ? (
                <img src={game.banner} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ background: game.gradient }} />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">{room.title}</h1>
            <div className="flex items-center gap-1.5">
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Users className="w-3 h-3" />
                {memberCount}/{room.max_players}
              </button>
              {partyDef && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${partyDef.color}1E`, color: partyDef.color, border: `1px solid ${partyDef.color}44` }}
                >
                  {partyDef.emoji} {partyDef.name}
                </span>
              )}
              {skillMeta && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase"
                  style={{ background: `${skillMeta.color}1E`, color: skillMeta.color, border: `1px solid ${skillMeta.color}44` }}
                >
                  {skillMeta.short}
                </span>
              )}
            </div>
          </div>

          {!isHost && (
            <button
              onClick={leaveRoom}
              className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* ━━━ VOICE STAGE — main area ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Anonymous — voice locked */}
        {isAnonymous ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/15 flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-300" />
            </div>
            <p className="text-sm font-semibold text-amber-200">Голос недоступен</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Анонимный профиль не может подключаться к звонкам.
              Выбери основной тип аккаунта на главной, чтобы разблокировать.
            </p>
            <button onClick={() => router.push("/")} className="neon-btn text-xs">
              Выбрать аккаунт
            </button>
          </div>
        ) : voiceCall.error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <MicOff className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-sm font-semibold text-red-300">Нет доступа к микрофону</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">{voiceCall.error}</p>
            <button onClick={() => voiceCall.joinCall()} className="neon-btn text-xs">
              Повторить
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto">
            {/* ━━━ PARTY GAME PANEL (voice-independent) ━━━ */}
            {room.category === "party" && (
              <GamePanel
                roomId={roomId}
                room={room}
                user={user}
                memberCount={memberCount}
                inCall={voiceCall.isInCall}
              />
            )}

            {/* Call status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  voiceCall.isInCall ? "bg-green-500 animate-pulse" : "bg-amber-400 animate-pulse"
                }`} />
                <span className="text-sm font-semibold">
                  {voiceCall.isInCall ? "Голосовой канал" : "Не в голосе"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {voiceCall.isInCall ? `${voiceCall.participants.length} в звонке` : `${memberCount} в комнате`}
              </span>
            </div>

            {/* ━━━ PRE-JOIN GATE — mic is requested ONLY here ━━━ */}
            {!voiceCall.isInCall ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 text-center"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(63,185,80,0.15), rgba(63,185,80,0.05))",
                    border: "1px solid rgba(63,185,80,0.35)",
                  }}
                >
                  <PhoneIncoming className="w-7 h-7 text-green-400" />
                </div>
                <p className="text-sm font-bold mb-1">Голосовой канал</p>
                <p className="text-xs text-muted-foreground mb-5 max-w-[260px] mx-auto leading-relaxed">
                  {partyDef
                    ? `Для «${partyDef.name}» нужен голос. Подключись, когда будешь готов.`
                    : "Загляни в голос — микрофон запрашивается только при входе в звонок, не при переходах по вкладкам."}
                </p>
                <button
                  onClick={() => {
                    haptic.impact("medium");
                    voiceCall.joinCall();
                  }}
                  className="neon-btn w-full text-sm py-3 flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  Присоединиться к голосу
                </button>
                <p className="text-[10px] text-muted-foreground/70 mt-3">
                  {memberCount > 1
                    ? `${memberCount - 1} ${memberCount - 1 === 1 ? "участник" : "участника"} уже здесь`
                    : "Пока ты один — позови друзей ссылкой!"}
                </p>
              </motion.div>
            ) : (
            <>
            {/* ── Discord-style participants grid ── */}
            <div className="grid grid-cols-2 gap-3">
              {voiceCall.participants.map((p) => {
                const speaking = p.isSpeaking && !p.isMuted && p.connectionState === "connected";
                return (
                  <motion.button
                    key={p.userId}
                    layout
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (p.userId === user.id) return;
                      openProfileCard(p.userId, p.firstName === "Вы" ? user.first_name : p.firstName, p.username, p.photoUrl, p.isHost || p.userId === room.host_id);
                    }}
                    className="glass-card p-4 flex flex-col items-center gap-2.5 relative"
                    style={
                      speaking
                        ? {
                            borderColor: "#3FB950",
                            boxShadow: "0 0 0 1px #3FB950, 0 0 18px rgba(63, 185, 80, 0.35)",
                          }
                        : undefined
                    }
                  >
                    {/* Host crown */}
                    {(p.isHost || p.userId === room.host_id) && (
                      <Crown
                        className="absolute top-2 right-2 w-4 h-4 text-amber-400"
                        fill="currentColor"
                      />
                    )}

                    <div className="relative">
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt=""
                          className="w-16 h-16 rounded-full object-cover transition-shadow"
                          style={{
                            boxShadow: speaking
                              ? "0 0 0 3px #3FB950, 0 0 16px rgba(63,185,80,0.5)"
                              : p.connectionState === "connected"
                              ? "0 0 0 2px rgba(63,185,80,0.3)"
                              : "0 0 0 2px rgba(255,182,39,0.4)",
                          }}
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold transition-shadow"
                          style={{
                            boxShadow: speaking
                              ? "0 0 0 3px #3FB950, 0 0 16px rgba(63,185,80,0.5)"
                              : p.connectionState === "connected"
                              ? "0 0 0 2px rgba(63,185,80,0.3)"
                              : "0 0 0 2px rgba(255,182,39,0.4)",
                          }}
                        >
                          {p.firstName?.[0] ?? "?"}
                        </div>
                      )}
                      {/* Speaking halo */}
                      <AnimatePresence>
                        {speaking && (
                          <motion.span
                            className="absolute inset-0 rounded-full"
                            style={{ boxShadow: "0 0 24px rgba(63,185,80,0.55)" }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: [1, 1.06, 1] }}
                            exit={{ opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                          />
                        )}
                      </AnimatePresence>
                      {/* Status badge */}
                      {p.isMuted ? (
                        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#0e141d]">
                          <MicOff className="w-3 h-3 text-white" />
                        </div>
                      ) : speaking ? (
                        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-[#0e141d]">
                          <Volume2 className="w-3 h-3 text-white" />
                        </div>
                      ) : null}
                    </div>

                    <p className="text-xs font-semibold truncate max-w-full">
                      {p.firstName === "Вы" ? (isHost ? "Вы (хост)" : "Вы") : p.firstName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.connectionState === "connecting" ? "подключение..." :
                       p.connectionState === "connected" ? (p.isMuted ? "микрофон выключен" : "в голосе") : "ошибка"}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            {/* Empty participants hint */}
            {voiceCall.participants.length === 1 && (
              <div className="glass-card p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Ожидание других участников... Поделись ссылкой на комнату!
                </p>
              </div>
            )}

            {/* Room members (not in call) */}
            {notInCall.length > 0 && (
              <div>
                <div className="section-label mb-2 px-1">В комнате, не в голосе ({notInCall.length})</div>
                <div className="flex flex-wrap gap-2">
                  {notInCall.map((m) => (
                    <button
                      key={m.user_id}
                      onClick={() => openProfileCard(m.user_id, m.user.first_name, m.user.username, m.user.photo_url, m.user_id === room.host_id)}
                      className="glass-card px-3 py-2 flex items-center gap-2"
                    >
                      {m.user.photo_url ? (
                        <img src={m.user.photo_url} alt="" className="w-6 h-6 rounded-full object-cover opacity-50" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold opacity-50">
                          {m.user.first_name?.[0] ?? "?"}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">{m.user.first_name}</span>
                      {m.user_id === room.host_id && (
                        <Crown className="w-3 h-3 text-amber-400" fill="currentColor" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </div>

      {/* ━━━ CALL CONTROLS (Discord-style bottom bar) ━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e141d] border-t border-border z-20">
        <div className="max-w-md mx-auto flex items-center justify-center gap-3 py-3 px-4 safe-area-inset-bottom">
          {/* Mute (self) */}
          <button
            onClick={() => {
              if (voiceCall.forceMuted) {
                haptic.error();
                return;
              }
              haptic.impact("light");
              voiceCall.toggleMute();
            }}
            disabled={isAnonymous || !voiceCall.isInCall}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
              voiceCall.forceMuted
                ? "bg-red-500/30 text-red-300 border border-red-500/50"
                : voiceCall.isMuted
                ? "bg-red-500/20 text-red-400"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
            aria-label={voiceCall.isMuted ? "Включить микрофон" : "Выключить микрофон"}
          >
            {voiceCall.forceMuted ? (
              <ShieldAlert className="w-5 h-5" />
            ) : voiceCall.isMuted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Deafen (mute output) */}
          <button
            onClick={() => {
              haptic.impact("light");
              setDeafened(!deafened);
            }}
            disabled={isAnonymous || !voiceCall.isInCall}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
              deafened
                ? "bg-red-500/20 text-red-400"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
            aria-label={deafened ? "Включить звук" : "Выключить звук"}
          >
            {deafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Leave call */}
          <button
            onClick={() => {
              haptic.impact("medium");
              voiceCall.leaveCall();
            }}
            disabled={isAnonymous || !voiceCall.isInCall}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
            aria-label="Покинуть звонок"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Toggle chat */}
          <button
            onClick={() => {
              haptic.impact("light");
              setShowChat(!showChat);
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors relative ${
              showChat ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"
            }`}
            aria-label="Открыть чат"
          >
            <MessageSquare className="w-5 h-5" />
            {messages.length > 0 && !showChat && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* ━━━ CHAT — collapsible draggable bottom sheet ━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-40 bg-[#0e141d] border-t border-border rounded-t-2xl flex flex-col"
            style={{ maxHeight: "62vh", boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) {
                setShowChat(false);
              }
            }}
          >
            {/* Drag handle */}
            <div className="pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none">
              <div className="w-10 h-1.5 rounded-full bg-white/15" />
            </div>

            {/* Sheet header */}
            <div className="px-4 pb-2 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Текстовый чат</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[160px]">
              {messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  Нет сообщений. Напиши первым!
                </p>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender.id === user.id;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                      {msg.sender.photo_url ? (
                        <img src={msg.sender.photo_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          {msg.sender.first_name?.[0] ?? "?"}
                        </div>
                      )}
                      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                        {!isMe && (
                          <p className="text-[10px] text-muted-foreground mb-0.5 px-1">
                            {msg.sender.username ? `@${msg.sender.username}` : msg.sender.first_name}
                            {msg.sender.id === room.host_id && (
                              <Crown className="inline w-2.5 h-2.5 ml-1 text-amber-400" fill="currentColor" />
                            )}
                          </p>
                        )}
                        <div className={`rounded-2xl px-3 py-1.5 text-sm break-words ${
                          isMe
                            ? "bg-primary text-[#0e141d] rounded-br-md"
                            : "bg-[#1b2838] border border-border rounded-bl-md"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="p-2 border-t border-border safe-area-inset-bottom">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Сообщение..."
                  maxLength={1000}
                  className="flex-1 px-4 py-2 rounded-full bg-[#1b2838] border border-border focus:border-primary outline-none text-sm"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="neon-btn !p-2 !rounded-full disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ PROFILE CARD POPUP (tap participant) ━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {profileCard && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(5, 8, 12, 0.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            onClick={() => setProfileCard(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
              className="glass-card p-5 w-full max-w-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                {profileCard.photoUrl ? (
                  <img
                    src={profileCard.photoUrl}
                    alt=""
                    className="w-20 h-20 rounded-2xl object-cover border-2"
                    style={{ borderColor: "var(--primary)" }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl font-bold neon-text border-2 border-primary">
                    {profileCard.firstName?.[0] ?? "?"}
                  </div>
                )}
                <h3 className="text-base font-bold mt-3 flex items-center gap-1.5">
                  {profileCard.firstName}
                  {profileCard.isHost && <Crown className="w-4 h-4 text-amber-400" fill="currentColor" />}
                </h3>
                {profileCard.username && (
                  <p className="text-xs text-muted-foreground">@{profileCard.username}</p>
                )}
                {profileCard.trustScore !== undefined && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Trust Score: <span className="text-primary font-bold">{profileCard.trustScore}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => {
                    setProfileCard(null);
                    router.push(`/users/${profileCard.userId}`);
                  }}
                  className="neon-btn text-xs py-2.5"
                >
                  Профиль
                </button>

                {isHost && profileCard.userId !== user.id && (
                  <>
                    <button
                      onClick={() => {
                        haptic.impact("medium");
                        voiceCall.muteParticipant(profileCard.userId);
                        setProfileCard(null);
                      }}
                      className="glass-card text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5 hover:border-amber-400/40 transition-colors"
                    >
                      <MicOff className="w-3.5 h-3.5 text-amber-400" />
                      Замутить
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`Кикнуть ${profileCard.firstName} из комнаты?`)) return;
                        haptic.impact("heavy");
                        voiceCall.kickParticipant(profileCard.userId);
                        setProfileCard(null);
                      }}
                      className="glass-card text-xs font-semibold py-2.5 col-span-2 flex items-center justify-center gap-1.5 hover:border-red-500/40 transition-colors"
                      style={{ background: "rgba(218, 48, 48, 0.08)" }}
                    >
                      <UserMinus className="w-3.5 h-3.5 text-red-400" />
                      Кикнуть из комнаты
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setProfileCard(null)}
                className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground py-2 mt-1 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronDown className="w-3 h-3" />
                Закрыть
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
