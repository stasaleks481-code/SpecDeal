"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Users } from "lucide-react";
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
      {/* Hero header — flat, no gradient overlay */}
      <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-[#1b2838]/40">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--primary)" }}
        >
          <span className="text-lg">🎮</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold neon-text leading-tight">
            Найди тиммейтов
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Создай лобби или присоединись
          </p>
        </div>
      </div>

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
          {GAMES.map((g) => {
            const isSelected = selectedGame === g.code;
            return (
              <button
                key={g.code}
                onClick={() => setSelectedGame(isSelected ? null : g.code)}
                className={`game-tile ${isSelected ? "game-tile--selected" : ""}`}
                style={{
                  // @ts-expect-error custom CSS var
                  "--game-color": g.color,
                  "--game-gradient": g.gradient,
                }}
              >
                {/* Background: Steam banner OR gradient fallback */}
                {g.banner ? (
                  <img
                    src={g.banner}
                    alt={g.name}
                    loading="lazy"
                    className="game-tile__banner"
                  />
                ) : null}
                <div className="game-tile__overlay" />

                {/* Content */}
                <div className="game-tile__content">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl drop-shadow-lg">{g.emoji}</span>
                    <span
                      className="game-tile__accent"
                      style={{ background: g.color, color: g.color }}
                    />
                  </div>
                  <div>
                    <div className="game-tile__title text-base">
                      {g.name}
                    </div>
                    <div className="text-[10px] font-medium text-white/70 mt-1 uppercase tracking-wider">
                      {g.formats.join(" · ")}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Other game button */}
          <button
            onClick={() => setSelectedGame(null)}
            className="game-tile"
            style={{
              // @ts-expect-error custom CSS var
              "--game-gradient": "linear-gradient(135deg, rgba(27, 40, 56, 0.6), rgba(14, 20, 29, 0.8))",
              "--game-color": "var(--muted-foreground)",
              borderStyle: "dashed",
            }}
          >
            <div className="game-tile__overlay" style={{ background: "rgba(14, 20, 29, 0.5)" }} />
            <div className="game-tile__content items-center justify-center !justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Search className="w-6 h-6" />
                <span className="text-xs font-semibold">Другая игра</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Filters — only when game is selected */}
      {selectedGameData && (
        <div className="space-y-4">
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
        </div>
      )}

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
            <p className="text-sm text-muted-foreground">Загружаем лобби...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold">Пока пусто</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {selectedGame
                ? `Нет активных лобби для ${selectedGameData?.name}. Создай первое!`
                : "Создай первое лобби и ждите тиммейтов"}
            </p>
            <button onClick={() => setShowCreate(true)} className="neon-btn text-xs">
              <Plus className="w-3 h-3 inline mr-1" />
              Создать лобби
            </button>
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
