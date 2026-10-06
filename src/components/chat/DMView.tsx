"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { UserRow } from "@/lib/supabase/client";
import { OnlineDot } from "@/components/icons";
import { useTelegramBackButton } from "@/lib/telegram/useBackButton";

interface DMMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface Partner {
  id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  is_online: boolean;
  last_seen_at: string;
}

interface Props {
  user: UserRow;
}

export function DMView({ user }: Props) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const partnerId = parseInt(params.id, 10);

  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Native Telegram BackButton
  const goBack = useCallback(() => router.push("/friends"), [router]);
  useTelegramBackButton(goBack);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/dm/${partnerId}?limit=50`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
      setPartner(data.partner);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for new DMs
  useEffect(() => {
    if (!partner) return;

    const channel = supabase
      .channel(`dm_${partnerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `or(and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id}))`,
        },
        (payload) => {
          const newMsg = payload.new as DMMessage
          setMessages((prev) => [...prev, newMsg])
          // Mark as read if it's from partner
          if (newMsg.sender_id === partnerId) {
            fetch(`/api/dm/${partnerId}`, { method: "GET", credentials: "include" })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [partner, partnerId, user.id])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    const content = input.trim()
    if (!content) return

    setInput("")
    inputRef.current?.focus()

    try {
      const res = await fetch(`/api/dm/${partnerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? "Failed to send")
        setInput(content)
      }
    } catch (err) {
      console.error("[send] error:", err)
      setInput(content)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    )
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <p className="text-sm font-semibold mb-2">Чат не найден</p>
          <p className="text-xs text-muted-foreground mb-4">{error ?? "Unknown error"}</p>
          <button onClick={() => router.push("/friends")} className="neon-btn text-xs w-full">
            К друзьям
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header — floating glass */}
      <header
        className="border-b border-border sticky top-0 z-20"
        style={{
          background: "linear-gradient(180deg, rgba(11,17,26,0.96) 0%, rgba(11,17,26,0.88) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/friends")}
            className="w-9 h-9 rounded-xl bg-white/[0.05] border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="relative">
            {partner.photo_url ? (
              <img
                src={partner.photo_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
                style={{
                  boxShadow: partner.is_online
                    ? "0 0 0 2px rgba(63,185,80,0.5), 0 0 12px -2px rgba(63,185,80,0.45)"
                    : "0 0 0 2px rgba(255,255,255,0.08)",
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                {partner.first_name?.[0] ?? "?"}
              </div>
            )}
            {partner.is_online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0b111a] shadow-[0_0_8px_rgba(63,185,80,0.8)]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate tracking-tight">
              {partner.username ? `@${partner.username}` : `${partner.first_name} ${partner.last_name ?? ""}`}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <OnlineDot online={partner.is_online} />
              {partner.is_online ? "онлайн" : `был(а) ${formatLastSeen(partner.last_seen_at)}`}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12 flex flex-col items-center gap-2">
            <MessageCircle className="w-8 h-8 text-primary/50" />
            <p>Начни общение с {partner.first_name}!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user.id
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%]`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
                      isMe
                        ? "text-[#071019] rounded-br-md font-medium"
                        : "text-foreground rounded-bl-md border border-border"
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
                  <p className={`text-[9px] text-muted-foreground mt-0.5 px-1 ${isMe ? "text-right" : ""}`}>
                    {formatTime(msg.created_at)}
                    {isMe && (msg.read_at ? " · прочитано" : " · отправлено")}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div
        className="border-t border-border p-2.5 safe-area-inset-bottom"
        style={{
          background: "linear-gradient(0deg, rgba(11,17,26,0.98) 0%, rgba(11,17,26,0.92) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
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
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

function formatLastSeen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return "только что"
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}м назад`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}ч назад`
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}
