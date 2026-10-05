"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Search, Plus, Gamepad2 } from "lucide-react";
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

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4">
      {/* Hero */}
      <div className="glass-card p-4">
        <h1 className="text-xl font-bold neon-text">🎮 Игры</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Найди тиммейтов для любимой игры
        </p>
      </div>

      {/* Games grid */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Популярные игры
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((g) => {
            const isSelected = selectedGame === g.code;
            return (
              <button
                key={g.code}
                onClick={() => setSelectedGame(isSelected ? null : g.code)}
                className={`game-card p-3 text-left ${isSelected ? "ring-2 ring-primary" : ""}`}
                style={{
                  boxShadow: isSelected
                    ? `0 0 16px ${g.color}50, inset 0 0 0 1px ${g.color}`
                    : undefined,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{g.emoji}</div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `${g.color}30`, color: g.color }}
                  >
                    {g.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {g.formats.join(" / ")}
                </p>
              </button>
            );
          })}

          {/* Other game button */}
          <button className="game-card p-3 text-left border-dashed">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Другая</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Поиск по всем</p>
          </button>
        </div>
      </div>

      {/* Filters */}
      {selectedGame && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-3"
        >
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Формат
            </h3>
            <div className="flex flex-wrap gap-2">
              {["2x2", "3x3", "5x5", "duo", "full"].map((f) => {
                const game = GAMES.find((g) => g.code === selectedGame);
                const isAvailable = !game || game.formats.includes(f as never);
                const active = filterFormat === f;
                return (
                  <button
                    key={f}
                    disabled={!isAvailable}
                    onClick={() => setFilterFormat(active ? null : f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? "neon-btn"
                        : isAvailable
                        ? "glass-card hover:border-primary/40"
                        : "opacity-40 cursor-not-allowed glass-card"
                    }`}
                  >
                    {f === "duo" ? "Дуо" : f === "full" ? "Полный" : f}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Стиль игры
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { code: "ranked", label: "Ранкед" },
                { code: "chill", label: "Чилл" },
                { code: "fun", label: "Фан" },
              ].map((s) => {
                const active = filterStyle === s.code;
                return (
                  <button
                    key={s.code}
                    onClick={() => setFilterStyle(active ? null : s.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active ? "neon-btn" : "glass-card hover:border-primary/40"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Rooms list */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            {selectedGame ? "Активные лобби" : "Все лобби"}
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
            <Gamepad2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Лобби нет</p>
            <p className="text-xs text-muted-foreground mt-1">
              Создай первое — жми «Создать»
            </p>
          </div>
        ) : (
          <GameRoomList rooms={rooms} currentUser={user} onJoined={fetchRooms} />
        )}
      </div>

      {/* Create room modal */}
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
    </div>
  );
}
