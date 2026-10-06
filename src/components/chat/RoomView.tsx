"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Crown, Mic, MicOff, PhoneOff, Users, LogOut,
  MessageSquare, Volume2, VolumeX, ShieldAlert, Lock, UserMinus, ChevronDown, X,
  Dices, PhoneIncoming, Settings2, Trash2,
} from "lucide-react";
import { GAMES, SKILL_LEVELS, partyGame, type SkillLevel } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";
import type { UserRow } from "@/lib/supabase/client";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";
import { haptic } from "@/lib/telegram/haptics";
import { useVoiceCall } from "@/lib/webrtc/useVoiceCall";
import { GamePanel } from "@/components/party/GamePanel";
import { PartyGameIcon } from "@/components/icons";
import { UserAvatar } from "@/components/cosmetics";

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
    avatar_frame?: string | null;
    name_style?: string | null;
    user_title?: string | null;
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
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [kickedLocally, setKickedLocally] = useState(false);
  /** Auto-rejoin allowed only on the FIRST fetch (mount), not on refetches */
  const autoJoinRef = useRef(true);

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
        // Room deleted / closed while we were inside → error screen
        // (also the polling fallback path when Realtime misses DELETEs)
        if (res.status === 404) {
          setRoom(null);
          setError("Комната была закрыта или удалена");
          return;
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRoom(data.room);
      const nextMembers: Member[] = data.members ?? [];
      setMembers(nextMembers);

      const isMember = nextMembers.some((m: Member) => m.user_id === user.id);
      let selfLeft = false;
      try {
        selfLeft = sessionStorage.getItem(`vd_self_left_${roomId}`) === "1";
      } catch { /* ignore */ }

      if (!isMember && !isAnonymous) {
        if (autoJoinRef.current || selfLeft) {
          // First entry, or coming back after our own hidden-tab beacon leave
          const joinRes = await fetch(`/api/rooms/${roomId}/join`, { method: "POST", credentials: "include" });
          if (!joinRes.ok) {
            const jdata = await joinRes.json().catch(() => ({}));
            throw new Error(jdata.error ?? "Failed to join");
          }
          try { sessionStorage.removeItem(`vd_self_left_${roomId}`); } catch { /* ignore */ }
          const refetch = await fetch(`/api/rooms/${roomId}`, { credentials: "include" });
          if (refetch.ok) {
            const rdata = await refetch.json();
            setMembers(rdata.members ?? []);
          }
        } else {
          // We WERE a member and someone removed us → kicked
          setKickedLocally(true);
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

  // Only the first fetch may auto-join — later refetches must treat a
  // missing membership as a kick, not a reason to silently re-join
  useEffect(() => {
    if (!loading) autoJoinRef.current = false;
  }, [loading]);

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
          // Full refetch: updates the member list AND catches room deletion
          // (404 → "room closed" screen)
          fetchRoom();
        }
      )
      .subscribe();

    // Polling fallback — room status stays correct even when the Realtime
    // websocket silently dies inside the Telegram WebView (ghost counts,
    // remote close/kick all surface within seconds)
    const pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") fetchRoom();
    }, 10_000);

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(memberChannel);
      clearInterval(pollTimer);
    };
  }, [room, roomId, fetchRoom]);

  useEffect(() => {
    if (showChat && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showChat]);

  // ── Ghost-count protection (client side) ────────────────────────
  // Hidden app + NOT in a call → beacon-leave so the member counter
  // drops immediately (sendBeacon survives WebView teardown; cookies
  // are attached automatically, middleware injects x-user-id).
  // Back to visible → re-sync (fetchRoom auto-rejoins when needed).
  const inCallRef = useRef(false);
  useEffect(() => {
    inCallRef.current = voiceCall.isInCall;
  }, [voiceCall.isInCall]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && !inCallRef.current) {
        try {
          // Mark as a self-leave so the return refetch re-joins instead of
          // treating the missing membership as a host kick
          sessionStorage.setItem(`vd_self_left_${roomId}`, "1");
          navigator.sendBeacon(`/api/rooms/${roomId}/leave`, new Blob([], { type: "text/plain" }));
        } catch { /* ignore */ }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchRoom();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
    };
  }, [roomId, fetchRoom]);

  // ── Host management ─────────────────────────────────────────────
  const endCallForAll = async () => {
    if (!confirm("Завершить созвон для всех участников?")) return;
    haptic.impact("heavy");
    try {
      await fetch(`/api/rooms/${roomId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "end_call" }),
      });
      await voiceCall.leaveCall();
    } catch (err) {
      console.error("[end_call] error:", err);
    }
    setShowHostMenu(false);
  };

  const deleteRoom = async () => {
    if (!confirm("Удалить комнату? Она будет закрыта и удалена для ВСЕХ участников.")) return;
    haptic.impact("heavy");
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) console.error("[delete] failed:", res.status);
    } catch (err) {
      console.error("[delete] error:", err);
    }
    setShowHostMenu(false);
    router.push("/");
  };

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
      try { sessionStorage.setItem(`vd_self_left_${roomId}`, "1"); } catch { /* ignore */ }
      await fetch(`/api/rooms/${roomId}/leave`, { method: "POST", credentials: "include" });
      router.push("/");
    } catch (err) {
      console.error("[leave] error:", err);
    }
  };

  // Kicked by host — full-screen notice
  if (voiceCall.kicked || kickedLocally) {
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

  // Host deleted the room while you were inside — full-screen notice
  if (voiceCall.closedNotice === "room") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/15 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-amber-300" />
          </div>
          <h2 className="text-lg font-bold mb-1">Комната закрыта</h2>
          <p className="text-sm text-muted-foreground mb-5">Хост завершил созвон и удалил комнату для всех участников</p>
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
          <p className="text-sm font-semibold mb-2">Комната закрыта или не существует</p>
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
      {/* Header — floating glass */}
      <header
        className="border-b border-border z-20"
        style={{
          background: "linear-gradient(180deg, rgba(11,17,26,0.96) 0%, rgba(11,17,26,0.88) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-white/[0.05] border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {game && (
            <div
              className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.14)", boxShadow: `0 4px 12px -4px ${game.color}70` }}
            >
              {game.banner ? (
                <img src={game.banner} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ background: game.gradient }} />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate tracking-tight">{room.title}</h1>
            <div className="flex items-center gap-1.5">
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Users className="w-3 h-3" />
                {memberCount}/{room.max_players}
              </button>
              {partyDef && (
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wide"
                  style={{ background: `${partyDef.color}22`, color: partyDef.color, border: `1px solid ${partyDef.color}50` }}
                >
                  <PartyGameIcon code={partyDef.code} className="w-3 h-3" />
                  {partyDef.name}
                </span>
              )}
              {skillMeta && (
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide"
                  style={{ background: `${skillMeta.color}22`, color: skillMeta.color, border: `1px solid ${skillMeta.color}50` }}
                >
                  {skillMeta.short}
                </span>
              )}
            </div>
          </div>

          {isHost ? (
            <>
              <button
                onClick={() => {
                  haptic.impact("light");
                  setShowHostMenu(true);
                }}
                className="w-9 h-9 rounded-xl bg-white/[0.05] border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-white/[0.08] transition-colors"
                aria-label="Управление комнатой"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button
                onClick={leaveRoom}
                className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400/90 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                aria-label="Выйти из комнаты"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={leaveRoom}
              className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400/90 hover:bg-red-500/20 hover:text-red-300 transition-colors"
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
              <div className="flex items-center gap-2.5">
                {voiceCall.isInCall ? (
                  <span className="vd-live" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
                <span className="text-sm font-bold">
                  {voiceCall.isInCall ? "Голосовой канал" : "Не в голосе"}
                </span>
                {voiceCall.closedNotice === "voice" && (
                  <span className="text-[11px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
                    Хост завершил созвон
                  </span>
                )}
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
                className="glass-card p-7 text-center relative overflow-hidden"
              >
                {/* soft green glow behind the tile */}
                <div
                  className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-40 pointer-events-none"
                  style={{ background: "radial-gradient(closest-side, rgba(63,185,80,0.16), transparent)", filter: "blur(4px)" }}
                />
                <div
                  className="w-16 h-16 vd-tile mx-auto mb-4"
                  style={{
                    background: "linear-gradient(140deg, rgba(63,185,80,0.3), rgba(34,197,94,0.12))",
                    border: "1px solid rgba(63,185,80,0.4)",
                    boxShadow: "0 10px 28px -8px rgba(63,185,80,0.5)",
                  }}
                >
                  <PhoneIncoming className="w-7 h-7 text-green-400" />
                </div>
                <p className="text-sm font-black mb-1">Голосовой канал</p>
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
                  className="neon-btn w-full text-sm py-3.5"
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
                      {(() => {
                        const member = members.find((mm) => mm.user_id === p.userId);
                        const ringShadow = speaking
                          ? "0 0 0 3px #3FB950, 0 0 16px rgba(63,185,80,0.5)"
                          : p.connectionState === "connected"
                          ? "0 0 0 2px rgba(63,185,80,0.3)"
                          : "0 0 0 2px rgba(255,182,39,0.4)";
                        // Player with an equipped avatar frame → draw the frame,
                        // connection/speaking ring stays on the outer wrapper
                        if (member?.user.avatar_frame) {
                          return (
                            <div className="rounded-full" style={{ boxShadow: ringShadow }}>
                              <UserAvatar user={member.user} size={64} />
                            </div>
                          );
                        }
                        return p.photoUrl ? (
                          <img
                            src={p.photoUrl}
                            alt=""
                            className="w-16 h-16 rounded-full object-cover transition-shadow"
                            style={{ boxShadow: ringShadow }}
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold transition-shadow"
                            style={{ boxShadow: ringShadow }}
                          >
                            {p.firstName?.[0] ?? "?"}
                          </div>
                        );
                      })()}
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

      {/* ━━━ CALL CONTROLS (premium bottom bar) ━━━━━━━━━━━━━━ */}
      <div
        className="border-t border-border z-20"
        style={{
          background: "linear-gradient(0deg, rgba(11,17,26,0.98) 0%, rgba(11,17,26,0.9) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div className="max-w-md mx-auto flex items-center justify-center gap-3.5 py-4 px-4 safe-area-inset-bottom">
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
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 border ${
              voiceCall.forceMuted
                ? "bg-red-500/25 text-red-300 border-red-500/50 shadow-[0_0_16px_-4px_rgba(255,77,106,0.5)]"
                : voiceCall.isMuted
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "text-white border-white/15"
            }`}
            style={
              !voiceCall.isMuted && !voiceCall.forceMuted
                ? {
                    background: "linear-gradient(140deg, rgba(63,185,80,0.28), rgba(34,197,94,0.12))",
                    borderColor: "rgba(63,185,80,0.45)",
                    boxShadow: "0 6px 18px -6px rgba(63,185,80,0.5)",
                  }
                : undefined
            }
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
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 border ${
              deafened
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-white/[0.05] text-muted-foreground hover:bg-white/[0.09] border-border"
            }`}
            aria-label={deafened ? "Включить звук" : "Выключить звук"}
          >
            {deafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Leave call — danger gradient orb */}
          <button
            onClick={() => {
              haptic.impact("medium");
              voiceCall.leaveCall();
            }}
            disabled={isAnonymous || !voiceCall.isInCall}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: "var(--grad-danger)",
              border: "1px solid rgba(255,130,140,0.5)",
              boxShadow: "0 10px 26px -8px rgba(255,77,106,0.6), 0 1px 0 rgba(255,255,255,0.3) inset",
            }}
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
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative border ${
              showChat
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-white/[0.05] text-muted-foreground hover:bg-white/[0.09] border-border"
            }`}
            aria-label="Открыть чат"
          >
            <MessageSquare className="w-5 h-5" />
            {messages.length > 0 && !showChat && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]" />
            )}
          </button>
        </div>
      </div>

      {/* ━━━ CHAT — collapsible draggable bottom sheet ━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-40 border-t border-border rounded-t-3xl flex flex-col"
            style={{
              maxHeight: "62vh",
              boxShadow: "0 -12px 48px rgba(0,0,0,0.65)",
              background: "linear-gradient(180deg, rgba(17,24,35,0.98), rgba(11,17,26,0.99))",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
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
            <div className="pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none">
              <div className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Sheet header */}
            <div className="px-4 pb-2.5 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">Текстовый чат</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2 min-h-[160px]">
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
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
                            isMe ? "text-[#071019] rounded-br-md font-medium" : "text-foreground rounded-bl-md border border-border"
                          }`}
                          style={
                            isMe
                              ? {
                                  background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #2f7cf6))",
                                  boxShadow: "0 4px 14px -6px color-mix(in srgb, var(--primary) 50%, transparent)",
                                }
                              : { background: "rgba(255,255,255,0.05)" }
                          }
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="p-2.5 border-t border-border safe-area-inset-bottom">
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
                  className="flex-1 vd-input !rounded-full !py-2.5"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="neon-btn !p-2.5 !rounded-full disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ HOST MANAGEMENT SHEET ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showHostMenu && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(5, 8, 12, 0.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            onClick={() => setShowHostMenu(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="w-full max-w-md border-t border-border rounded-t-3xl p-4 pb-6 safe-area-inset-bottom"
              style={{
                background: "linear-gradient(180deg, rgba(17,24,35,0.98), rgba(11,17,26,0.99))",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1.5 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(140deg, rgba(47,124,246,0.25), rgba(123,92,240,0.12))", border: "1px solid rgba(94,108,243,0.3)" }}>
                    <Settings2 className="w-4 h-4 text-[#8db4ff]" />
                  </span>
                  <span className="text-sm font-bold">Управление комнатой</span>
                </div>
                <button
                  onClick={() => setShowHostMenu(false)}
                  className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* End call for everyone */}
              <button
                onClick={endCallForAll}
                className="w-full room-card p-3.5 flex items-center gap-3 text-left mb-2.5"
                style={{
                  background: "linear-gradient(135deg, rgba(255,182,39,0.1), rgba(255,138,39,0.04))",
                  borderColor: "rgba(255,182,39,0.32)",
                }}
              >
                <div
                  className="vd-tile w-10 h-10"
                  style={{ background: "linear-gradient(140deg, #ffd76f, #ff9d3d)", border: "1px solid rgba(255,220,140,0.4)" }}
                >
                  <VolumeX className="w-5 h-5 text-[#3a2506]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">Завершить созвон</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Все выйдут из голоса — комната останется открытой
                  </p>
                </div>
              </button>

              {/* Delete room — danger gradient */}
              <button
                onClick={deleteRoom}
                className="w-full rounded-[19px] p-[1px] text-left"
                style={{ background: "linear-gradient(120deg, rgba(255,77,106,0.7), rgba(255,133,81,0.5) 60%, rgba(255,255,255,0.05))" }}
              >
                <div className="rounded-[18px] p-3.5 flex items-center gap-3" style={{ background: "linear-gradient(180deg, rgba(30,18,22,0.98), rgba(17,13,15,0.99))" }}>
                  <div
                    className="vd-tile w-10 h-10"
                    style={{ background: "var(--grad-danger)", border: "1px solid rgba(255,140,150,0.45)" }}
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-200">Удалить комнату</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Принудительно закроет и удалит её для всех участников
                    </p>
                  </div>
                </div>
              </button>

              <p className="text-[11px] text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                <UserMinus className="w-3 h-3" />
                Мут и кик отдельного участника — тап по его карточке
              </p>
            </motion.div>
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
