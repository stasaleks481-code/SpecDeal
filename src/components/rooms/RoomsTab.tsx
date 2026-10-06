"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Users, Moon, Music, Film, MessageCircle } from "lucide-react";
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
    <div className="max-w-md mx-auto px-4 py-4 space-y-4">
      {/* Hero */}
      <div className="glass-card p-4">
        <h1 className="text-xl font-bold neon-text">💬 Чилл & Общение</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Найди с кем поговорить — тет-а-тет или в комнату
        </p>
      </div>

      {/* Topics filter */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Темы
        </h2>
        <div className="flex flex-wrap gap-2">
          {CASUAL_TOPICS.map((t) => {
            const active = filterTopic === t.code;
            return (
              <button
                key={t.code}
                onClick={() => setFilterTopic(active ? null : t.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  active ? "neon-btn" : "glass-card"
                }`}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Room size quick filters */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { size: 2, label: "1-на-1", icon: <Users className="w-3 h-3" /> },
          { size: 3, label: "на 3", icon: <Users className="w-3 h-3" /> },
          { size: 4, label: "на 4", icon: <Users className="w-3 h-3" /> },
          { size: 5, label: "на 5", icon: <Users className="w-3 h-3" /> },
        ].map((s) => (
          <button
            key={s.size}
            onClick={() => setFilterTopic(null)}
            className="glass-card p-3 flex flex-col items-center gap-1 text-xs"
          >
            <div className="text-primary">{s.icon}</div>
            <span className="font-semibold">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Rooms list */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Активные комнаты
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Plus className="w-3 h-3" />
            Создать
          </button>
        </div>

        {loading ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Комнат нет</p>
            <p className="text-xs text-muted-foreground mt-1">
              Создай первую — жми «Создать»
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room, idx) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="glass-card p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{room.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {room.topic_tags.slice(0, 3).map((tag) => {
                        const topic = CASUAL_TOPICS.find((t) => t.code === tag);
                        return (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                          >
                            {topic?.emoji} {topic?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <div className="text-xs text-muted-foreground">
                      до {room.max_players}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
