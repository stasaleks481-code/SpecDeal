"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LifeBuoy, Plus, X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { TicketTypeIcon } from "@/components/icons";
import type { SupportTicketRow, SupportTicketType } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";

/**
 * SupportCenter — in-app support dialog:
 * create tickets (bug / idea / question) and track admin replies.
 * Entry point: Profile → Настройки → Поддержка.
 */

const TYPE_META: Record<SupportTicketType, { label: string; hint: string; color: string }> = {
  bug: { label: "Баг", hint: "Что-то сломалось или работает криво", color: "#FF4655" },
  idea: { label: "Идея", hint: "Предложение по улучшению VoiceDeck", color: "#F7A600" },
  question: { label: "Вопрос", hint: "Как что-то работает, помощь по приложению", color: "#00f0ff" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: "Новый", color: "#00f0ff" },
  in_progress: { label: "В работе", color: "#F7A600" },
  resolved: { label: "Решён", color: "#3FB950" },
};

const DISMISS_KEY = "voicedeck_support_dismiss_v1";

export function SupportCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"new" | "my">("new");
  const [type, setType] = useState<SupportTicketType>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
      if (tab === "my") loadTickets();
    }
  }, [open, tab, loadTickets]);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить");
        haptic.error();
        return;
      }
      haptic.success();
      setSent(true);
      setSubject("");
      setMessage("");
      setType("bug");
      setTimeout(() => { setTab("my"); setSent(false); }, 1400);
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="w-full max-w-md rounded-t-3xl bg-[#0e141d] border-t border-x border-border max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 pb-3 border-b border-border shrink-0">
              <div className="mx-auto w-10 h-1 rounded-full bg-white/15 mb-3" />
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <LifeBuoy className="w-5 h-5 text-primary" />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-bold">Поддержка VoiceDeck</h2>
                  <p className="text-[10px] text-muted-foreground">Баги, идеи, вопросы — отвечаем быстро</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-black/30 rounded-xl border border-border mt-3">
                <button
                  onClick={() => setTab("new")}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === "new" ? "neon-btn" : "text-muted-foreground"}`}
                >
                  Написать
                </button>
                <button
                  onClick={() => setTab("my")}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${tab === "my" ? "neon-btn" : "text-muted-foreground"}`}
                >
                  Мои обращения
                  {tickets.filter((t) => t.status !== "resolved").length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-primary text-[#0e141d]">
                      {tickets.filter((t) => t.status !== "resolved").length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {tab === "new" ? (
                sent ? (
                  <div className="text-center py-10">
                    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <CheckCircle2 className="w-14 h-14 mx-auto text-green-400" />
                    </motion.div>
                    <p className="text-sm font-bold mt-3">Обращение отправлено!</p>
                    <p className="text-xs text-muted-foreground mt-1">Ответ появится в разделе «Мои обращения»</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Type selector */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Тип обращения</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(Object.entries(TYPE_META) as [SupportTicketType, (typeof TYPE_META)[SupportTicketType]][]).map(([t, meta]) => (
                          <button
                            key={t}
                            onClick={() => { haptic.impact("light"); setType(t); }}
                            className="p-3 rounded-xl border text-center transition-all"
                            style={{
                              background: type === t ? `${meta.color}14` : "rgba(255,255,255,0.02)",
                              borderColor: type === t ? meta.color : "rgba(255,255,255,0.1)",
                              boxShadow: type === t ? `0 0 12px ${meta.color}35` : "none",
                            }}
                          >
                            <TicketTypeIcon type={t} className="w-5 h-5 mx-auto mb-1.5" />
                            <p className="text-xs font-bold" style={{ color: type === t ? meta.color : undefined }}>{meta.label}</p>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">{TYPE_META[type].hint}</p>
                    </div>

                    {/* Subject */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Тема</p>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        maxLength={120}
                        placeholder="Коротко: что случилось / что предлагаешь"
                        className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/60"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
                        Сообщение
                      </p>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={2000}
                        rows={5}
                        placeholder="Опиши подробно. Для бага: что делал, что ожидал, что получилось."
                        className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/60 resize-none"
                      />
                      <p className="text-[10px] text-muted-foreground/60 text-right mt-1">{message.length}/2000</p>
                    </div>

                    {error && <p className="text-xs text-red-400 text-center">{error}</p>}

                    <button
                      onClick={submit}
                      disabled={sending || subject.trim().length < 3 || message.trim().length < 10}
                      className="neon-btn w-full text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? "Отправляем..." : "Отправить обращение"}
                    </button>
                  </div>
                )
              ) : (
                /* My tickets */
                <div className="space-y-2.5">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="text-center py-10">
                      <LifeBuoy className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">Обращений пока нет</p>
                    </div>
                  ) : (
                    tickets.map((t) => {
                      const sm = STATUS_META[t.status] ?? STATUS_META.new;
                      const tm = TYPE_META[t.type] ?? TYPE_META.question;
                      return (
                        <div key={t.id} className="glass-card p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate">{t.subject}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <TicketTypeIcon type={t.type} className="w-3 h-3" style={{ color: tm.color }} />
                                {tm.label} · {new Date(t.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <span
                              className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: `${sm.color}1E`, color: sm.color, border: `1px solid ${sm.color}44` }}
                            >
                              {sm.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap bg-black/25 rounded-lg p-2.5 border border-border">
                            {t.message}
                          </p>
                          {t.admin_reply && (
                            <div className="text-[11px] p-2.5 rounded-lg" style={{ background: "rgba(63,185,80,0.08)", border: "1px solid rgba(63,185,80,0.3)" }}>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-green-400 mb-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ответ поддержки
                              </p>
                              <p className="whitespace-pre-wrap">{t.admin_reply}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Dismissible entry hint shown once on the profile settings tab */
export function shouldShowSupportHint(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

export function dismissSupportHint(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch { /* ignore */ }
}
