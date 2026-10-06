"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Users, Sparkles } from "lucide-react";
import { GAMES, type UserRow, type RoomRow } from "@/lib/supabase/client";
import { GameRoomList } from "./GameRoomList";
import { CreateRoomModal } from "./CreateRoomModal";

interface Props {
  user: UserRow;
}

export function GamesTab({ user }: Props) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filterFormat, setFilterFormat] = useState<string | null>(null);
  const [filterStyle, setFilterStyle] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: "game" });
      if (selectedGame) params.set("game", selectedGame);
      if (filterFormat) params.set("format", filterFormat);
      if (filterStyle) params.set("style", filterStyle);

      const res = await fetch(`/api/rooms?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedGame, filterFormat, filterStyle]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const selectedGameData = GAMES.find((g) => g.code === selectedGame);

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-6 space-y-5">
      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(102, 192, 244, 0.04) 100%)",
          border: "1px solid rgba(102, 192, 244, 0.15)",
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
            <Sparkles className="w-5 h-5 text-[#0e141d]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold neon-text leading-tight">
              Найди тиммейтов
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Создай лобби или присоединись к существующему
            </p>
          </div>
        </div>
      </motion.div>

      {/* Games grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="section-label">Выбери игру</span>
          {selectedGame && (
            <button
              onClick={() => {
                setSelectedGame(null);
                setFilterFormat(null);
                setFilterStyle(null);
              }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Сбросить ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((g, idx) => {
            const isSelected = selectedGame === g.code;
            return (
              <motion.button
                key={g.code}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedGame(isSelected ? null : g.code)}
                className={`game-tile ${isSelected ? "game-tile--selected" : ""} p-3 flex flex-col justify-between`}
                style={{
                  // @ts-expect-error custom CSS vars
                  "--game-color": g.color,
                  "--game-gradient": g.gradient,
                  "--game-text-shadow": g.textShadow,
                }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl drop-shadow-lg">{g.emoji}</span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: g.color, boxShadow: `0 0 6px ${g.color}` }}
                  />
                </div>
                <div>
                  <div
                    className="game-title text-lg"
                    style={{ color: g.color }}
                  >
                    {g.name}
                  </div>
                  <div className="text-[10px] font-medium text-white/60 mt-1 uppercase tracking-wider">
                    {g.formats.join(" · ")}
                  </div>
                </div>
              </motion.button>
            );
          })}

          {/* Other game button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: GAMES.length * 0.04 }}
            whileTap={{ scale: 0.96 }}
            className="game-tile p-3 flex flex-col items-center justify-center gap-2 text-muted-foreground"
            style={{
              // @ts-expect-error custom CSS vars
              "--game-gradient": "linear-gradient(135deg, rgba(27, 40, 56, 0.6), rgba(14, 20, 29, 0.8))",
              "--game-color": "var(--muted-foreground)",
              borderStyle: "dashed",
            }}
          >
            <Search className="w-6 h-6" />
            <span className="text-xs font-semibold">Другая игра</span>
          </motion.button>
        </div>
      </div>

      {/* Filters — only when game is selected */}
      <AnimatePresence>
        {selectedGameData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <div>
              <div className="section-label mb-2 px-1">Формат</div>
              <div className="flex flex-wrap gap-2">
                {["2x2", "3x3", "5x5", "duo", "full"].map((f) => {
                  const isAvailable = selectedGameData.formats.includes(f as never);
                  const active = filterFormat === f;
                  return (
                    <button
                      key={f}
                      disabled={!isAvailable}
                      onClick={() => setFilterFormat(active ? null : f)}
                      className={`chip ${active ? "chip--active" : ""} ${!isAvailable ? "opacity-30 cursor-not-allowed" : ""}`}
                      style={active ? { background: selectedGameData.color, borderColor: selectedGameData.color } : {}}
                    >
                      {f === "duo" ? "Дуо" : f === "full" ? "Полный" : f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="section-label mb-2 px-1">Стиль игры</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: "ranked", label: "Ранкед", emoji: "🏆" },
                  { code: "chill", label: "Чилл", emoji: "😎" },
                  { code: "fun", label: "Фан", emoji: "🎮" },
                ].map((s) => {
                  const active = filterStyle === s.code;
                  return (
                    <button
                      key={s.code}
                      onClick={() => setFilterStyle(active ? null : s.code)}
                      className={`chip ${active ? "chip--active" : ""}`}
                    >
                      {s.emoji} {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rooms list */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="section-label">
              {selectedGame ? "Активные лобби" : "Все лобби"}
            </span>
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
              Загружаем лобби...
            </motion.div>
          </div>
        ) : rooms.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-semibold">Пока пусто</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {selectedGame
                ? `Нет активных лобби для ${selectedGameData?.name}. Создай первое!`
                : "Создай первое лобби и ждите тиммейтов"}
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="neon-btn text-xs"
            >
              <Plus className="w-3 h-3 inline mr-1" />
              Создать лобби
            </button>
          </motion.div>
        ) : (
          <GameRoomList rooms={rooms} currentUser={user} onJoined={fetchRooms} />
        )}
      </div>

      {/* Create room modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateRoomModal
            user={user}
            defaultCategory="game"
            defaultGame={selectedGame}
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
