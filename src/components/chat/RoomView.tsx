"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Users, Crown, Phone, Settings, LogOut } from "lucide-react";
import { GAMES, CASUAL_TOPICS } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";
import type { UserRow } from "@/lib/supabase/client";
import { VoiceCallModal } from "@/components/voice/VoiceCallModal";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";

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
  const [showVoice, setShowVoice] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Native Telegram BackButton support
  const goBack = useCallback(() => router.push("/"), [router]);
  useTelegramBackButton(goBack);

  // Fetch room + members + messages
  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRoom(data.room);
      setMembers(data.members ?? []);

      // Join room if not already member (auto-join on view)
      const isMember = (data.members ?? []).some(
        (m: Member) => m.user_id === user.id
      );
      if (!isMember && data.room.host_id !== user.id) {
        const joinRes = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" });
        if (!joinRes.ok) {
          const jdata = await joinRes.json().catch(() => ({}));
          throw new Error(jdata.error ?? "Failed to join");
        }
        // Refetch to get updated member list including me
        const refetch = await fetch(`/api/rooms/${roomId}`);
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
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`);
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

  // Realtime subscription for new messages + member changes
  useEffect(() => {
    if (!room) return;

    // Subscribe to new messages
    const msgChannel = supabase
      .channel(`room_messages_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as { id: number; content: string; created_at: string; sender_id: number };
          // Fetch sender info
          const { data: sender } = await supabase
            .from("users")
            .select("id, username, first_name, last_name, photo_url")
            .eq("id", newMsg.sender_id)
            .maybeSingle();

          setMessages((prev) => [
            ...prev,
            {
              ...newMsg,
              sender: sender ?? { id: newMsg.sender_id, username: null, first_name: "?", last_name: null, photo_url: null },
            },
          ]);
        }
      )
      .subscribe();

    // Subscribe to member changes
    const memberChannel = supabase
      .channel(`room_members_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        async () => {
          // Refetch members
          const res = await fetch(`/api/rooms/${roomId}`);
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

  // Auto-scroll on new messages
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
        alert(data.error ?? "Failed to send");
        setInput(content); // restore on error
      }
    } catch (err) {
      console.error("[send] error:", err);
      setInput(content);
    }
  };

  const leaveRoom = async () => {
    if (!confirm("Выйти из комнаты?")) return;
    try {
      await fetch(`/api/rooms/${roomId}/leave`, { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("[leave] error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
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
  const isFull = memberCount >= room.max_players;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-[#0e141d] border-b border-border sticky top-0 z-20">
        <div className="neon-strip" />
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Game icon */}
          {game && (
            <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0">
              {game.banner ? (
                <img src={game.banner} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl" style={{ background: game.gradient }}>
                  {game.emoji}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">{room.title}</h1>
            <button
              onClick={() => setShowMembers(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Users className="w-3 h-3" />
              {memberCount}/{room.max_players}
            </button>
          </div>

          {/* Voice call button */}
          <button
            onClick={() => setShowVoice(true)}
            className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            title="Голосовой чат"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Leave button */}
          {!isHost && (
            <button
              onClick={leaveRoom}
              className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
              title="Выйти из комнаты"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <p>👋 Привет! Это комната чата.</p>
            <p className="mt-1 text-xs">Напиши первое сообщение!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender.id === user.id;
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                {msg.sender.photo_url ? (
                  <img
                    src={msg.sender.photo_url}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {msg.sender.first_name?.[0] ?? "?"}
                  </div>
                )}

                {/* Bubble */}
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
                    className={`rounded-2xl px-3 py-2 text-sm break-words ${
                      isMe
                        ? "bg-primary text-[#0e141d] rounded-br-md font-medium"
                        : "bg-[#1b2838] border border-border rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className={`text-[9px] text-muted-foreground mt-0.5 px-1 ${isMe ? "text-right" : ""}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="bg-[#0e141d] border-t border-border p-2 safe-area-inset-bottom">
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
            className="flex-1 px-4 py-2.5 rounded-full bg-[#1b2838] border border-border focus:border-primary outline-none text-sm transition-colors"
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

      {/* Voice call modal */}
      {showVoice && <VoiceCallModal onClose={() => setShowVoice(false)} />}

      {/* Members panel (slide-up) */}
      {showMembers && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setShowMembers(false)}
        >
          <div
            className="glass-card rounded-b-none sm:rounded-2xl w-full max-w-md mx-auto p-4 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Участники ({memberCount}/{room.max_players})</h2>
              <button onClick={() => setShowMembers(false)} className="text-muted-foreground text-xl">×</button>
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5">
                  {m.user.photo_url ? (
                    <img src={m.user.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                      {m.user.first_name?.[0] ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1">
                      {m.user.username ? `@${m.user.username}` : m.user.first_name}
                      {m.user_id === room.host_id && (
                        <Crown className="w-3 h-3 text-amber-400" fill="currentColor" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.user_id === user.id ? "Вы" : m.user_id === room.host_id ? "Хост" : "Участник"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {isFull && (
              <p className="text-center text-xs text-amber-400 mt-3">⚠ Комната заполнена</p>
            )}
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
