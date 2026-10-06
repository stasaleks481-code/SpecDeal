"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Crown, Mic, MicOff, PhoneOff, Users, LogOut, MessageSquare, Volume2 } from "lucide-react";
import { GAMES } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";
import type { UserRow } from "@/lib/supabase/client";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";
import { haptic } from "@/lib/telegram/haptics";
import { useVoiceCall } from "@/lib/webrtc/useVoiceCall";

interface RoomData {
  id: string;
  host_id: number;
  category: "game" | "casual";
  game_name: string | null;
  game_format: string | null;
  play_style: string | null;
  topic_tags: string[];
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

interface Props {
  user: UserRow;
}

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
  const [error, setError] = useState<string | null>(null);

  // Voice call — auto-joins on mount
  const voiceCall = useVoiceCall({
    roomId,
    userId: user.id,
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
      if (!isMember && data.room.host_id !== user.id) {
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
  }, [roomId, user.id]);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
  const isHost = room.host_id === user.id;
  const memberCount = members.length;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-[#0e141d] border-b border-border">
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
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Users className="w-3 h-3" />
              {memberCount}/{room.max_players}
            </button>
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

      {/* ━━━ VOICE CALL — main area ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {voiceCall.error ? (
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
          <div className="space-y-4">
            {/* Call status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  voiceCall.isInCall ? "bg-green-500 animate-pulse" : "bg-amber-400 animate-pulse"
                }`} />
                <span className="text-sm font-semibold">
                  {voiceCall.isInCall ? "В звонке" : "Подключение..."}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {voiceCall.participants.length} в звонке
              </span>
            </div>

            {/* Participants grid */}
            <div className="grid grid-cols-2 gap-3">
              {voiceCall.participants.map((p) => (
                <div
                  key={p.userId}
                  className="glass-card p-4 flex flex-col items-center gap-2"
                >
                  <div className="relative">
                    {p.photoUrl ? (
                      <img
                        src={p.photoUrl}
                        alt=""
                        className={`w-16 h-16 rounded-2xl object-cover ${
                          p.connectionState === "connected" ? "ring-2 ring-green-500/50" : "ring-2 ring-amber-400/50"
                        }`}
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold ${
                        p.connectionState === "connected" ? "ring-2 ring-green-500/50" : "ring-2 ring-amber-400/50"
                      }`}>
                        {p.firstName?.[0] ?? "?"}
                      </div>
                    )}
                    {/* Mute indicator */}
                    {p.isMuted && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#0e141d]">
                        <MicOff className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {/* Speaking indicator */}
                    {p.connectionState === "connected" && !p.isMuted && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-[#0e141d]">
                        <Volume2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold truncate max-w-full">{p.firstName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.connectionState === "connecting" ? "подключение..." :
                     p.connectionState === "connected" ? "онлайн" : "ошибка"}
                  </p>
                </div>
              ))}
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
            {members.length > voiceCall.participants.length && (
              <div>
                <div className="section-label mb-2 px-1">В комнате ({members.length})</div>
                <div className="flex flex-wrap gap-2">
                  {members
                    .filter((m) => !voiceCall.participants.some((p) => p.userId === m.user_id))
                    .map((m) => (
                      <div key={m.user_id} className="glass-card px-3 py-2 flex items-center gap-2">
                        {m.user.photo_url ? (
                          <img src={m.user.photo_url} alt="" className="w-6 h-6 rounded-full object-cover opacity-50" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold opacity-50">
                            {m.user.first_name?.[0] ?? "?"}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">{m.user.first_name}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ━━━ CALL CONTROLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#0e141d] border-t border-border">
        <div className="max-w-md mx-auto flex items-center justify-center gap-3 py-3 px-4 safe-area-inset-bottom">
          {/* Mute */}
          <button
            onClick={() => {
              haptic.impact("light");
              voiceCall.toggleMute();
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              voiceCall.isMuted
                ? "bg-red-500/20 text-red-400"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {voiceCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Leave call */}
          <button
            onClick={() => {
              haptic.impact("medium");
              voiceCall.leaveCall();
            }}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Toggle chat */}
          <button
            onClick={() => {
              haptic.impact("light");
              setShowChat(!showChat);
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              showChat ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ━━━ CHAT (collapsible, slides up) ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showChat && (
        <div className="bg-[#0e141d] border-t border-border max-h-[50vh] flex flex-col">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[200px]">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
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
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
