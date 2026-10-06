"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, MessageCircle, Moon } from "lucide-react";
import { CASUAL_TOPICS, type UserRow, type RoomRow } from "@/lib/supabase/client";
import { CreateRoomModal } from "@/components/games/CreateRoomModal";

interface Props {
  user: UserRow;
}

export function RoomsTab({ user }: Props) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTopic, setFilterTopic] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: "casual" });
      if (filterTopic) params.set("topic", filterTopic);
      const res = await fetch(`/api/rooms?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filterTopic]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-5">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(155, 89, 182, 0.08) 0%, rgba(102, 192, 244, 0.04) 100%)",
          border: "1px solid rgba(155, 89, 182, 0.15)",
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-30" style={{ background: "var(--primary)" }} />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 50%, #1b2838))",
              boxShadow: "0 0 16px color-mix(in srgb, var(--primary) 40%, transparent)"
            }}
          >
            <Moon className="w-5 h-5 text-[#0e141d]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold neon-text leading-tight">
              Чилл & Общение
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Поговори по душам или обсуди кино
            </p>
          </div>
        </div>
      </motion.div>

      {/* Topics filter */}
      <div>
        <div className="section-label mb-2 px-1">Тема разговора</div>
        <div className="flex flex-wrap gap-2">
          {CASUAL_TOPICS.map((t) => {
            const active = filterTopic === t.code;
            return (
              <button
                key={t.code}
                onClick={() => setFilterTopic(active ? null : t.code)}
                className={`topic-pill ${active ? "topic-pill--active" : ""}`}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Room size quick filters */}
      <div>
        <div className="section-label mb-2 px-1">Размер комнаты</div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { size: 2, label: "1-на-1", sub: "Тет-а-тет" },
            { size: 3, label: "Тройка", sub: "Небольшая" },
            { size: 4, label: "Квартет", sub: "Средняя" },
            { size: 5, label: "Пятёрка", sub: "Полная" },
          ].map((s) => (
            <button
              key={s.size}
              onClick={() => setFilterTopic(null)}
              className="glass-card p-3 flex flex-col items-center gap-0.5 text-center hover:border-primary/40 transition-colors"
            >
              <div className="text-primary">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold">{s.label}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Rooms list */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="section-label">Активные комнаты</span>
            {rooms.length > 0 && (
              <span className="text-xs text-muted-foreground">({rooms.length})</span>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Создать
          </button>
        </div>

        {loading ? (
          <div className="glass-card p-8 text-center">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-sm text-muted-foreground"
            >
              Загружаем комнаты...
            </motion.div>
          </div>
        ) : rooms.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-semibold">Тишина...</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {filterTopic
                ? "По этой теме пока пусто. Создай комнату!"
                : "Создай первую комнату и позови людей"}
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="neon-btn text-xs"
            >
              <Plus className="w-3 h-3 inline mr-1" />
              Создать комнату
            </button>
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            {rooms.map((room, idx) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="room-card"
                style={{ borderLeft: "3px solid var(--primary)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{room.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {room.topic_tags.slice(0, 3).map((tag) => {
                        const topic = CASUAL_TOPICS.find((t) => t.code === tag);
                        return (
                          <span
                            key={tag}
                            className="chip"
                            style={{
                              background: "rgba(155, 89, 182, 0.15)",
                              borderColor: "rgba(155, 89, 182, 0.3)",
                              color: "#c39bd3",
                            }}
                          >
                            {topic?.emoji} {topic?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0 flex items-center gap-1 text-xs">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="font-bold">{room.max_players}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateRoomModal
            user={user}
            defaultCategory="casual"
            defaultGame={null}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              fetchRooms();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
