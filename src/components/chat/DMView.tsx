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
      {/* Header */}
      <header className="bg-[#0e141d] border-b border-border sticky top-0 z-20">
        <div className="neon-strip" />
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/friends")}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="relative">
            {partner.photo_url ? (
              <img src={partner.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                {partner.first_name?.[0] ?? "?"}
              </div>
            )}
            {partner.is_online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0e141d]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">
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
                    {isMe && (msg.read_at ? " · прочитано" : " · отправлено")}
                  </p>
                </div>
              </div>
            )
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
                e.preventDefault()
                sendMessage()
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
