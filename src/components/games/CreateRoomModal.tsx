"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Users } from "lucide-react";
import { GAMES, CASUAL_TOPICS, type UserRow } from "@/lib/supabase/client";

interface Props {
  user: UserRow;
  defaultCategory: "game" | "casual";
  defaultGame: string | null;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export function CreateRoomModal({
  user: _user,
  defaultCategory,
  defaultGame,
  onClose,
  onCreated,
}: Props) {
  const [category, setCategory] = useState<"game" | "casual">(defaultCategory);
  const [game, setGame] = useState<string>(defaultGame ?? "cs2");
  const [format, setFormat] = useState<string>("5x5");
  const [style, setStyle] = useState<string>("chill");
  const [title, setTitle] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["talk"]);
  const [submitting, setSubmitting] = useState(false);

  const toggleTopic = (code: string) => {
    setSelectedTopics((prev) =>
      prev.includes(code) ? prev.filter((t) => t !== code) : [...prev, code]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("Введите название комнаты");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          game_name: category === "game" ? game : null,
          game_format: category === "game" ? format : null,
          play_style: category === "game" ? style : null,
          topic_tags: category === "casual" ? selectedTopics : [],
          title: title.trim(),
          max_players: maxPlayers,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.room.id);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to create");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedGame = GAMES.find((g) => g.code === game);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="glass-card p-5 w-full max-w-md max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold neon-text">Создать комнату</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category toggle */}
        <div className="flex gap-2 mb-5 p-1 bg-background/40 rounded-xl border border-border">
          <button
            onClick={() => setCategory("game")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              category === "game" ? "neon-btn" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🎮 Игра
          </button>
          <button
            onClick={() => setCategory("casual")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              category === "casual" ? "neon-btn" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            💬 Общение
          </button>
        </div>

        {/* Game-specific */}
        {category === "game" && selectedGame && (
          <div className="space-y-4 mb-4">
            <div>
              <div className="section-label mb-2">Игра</div>
              <div className="grid grid-cols-4 gap-2">
                {GAMES.map((g) => {
                  const isSelected = game === g.code;
                  return (
                    <button
                      key={g.code}
                      onClick={() => setGame(g.code)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden ${
                        isSelected ? "scale-105" : ""
                      }`}
                      style={{
                        background: isSelected ? g.gradient : "rgba(255,255,255,0.03)",
                        border: isSelected ? `2px solid ${g.color}` : "1px solid var(--border)",
                        boxShadow: isSelected ? `0 0 16px ${g.color}50` : "none",
                      }}
                    >
                      <span className="text-xl drop-shadow-lg">{g.emoji}</span>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: isSelected ? "#fff" : g.color }}
                      >
                        {g.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="section-label mb-2">Формат</div>
              <div className="flex flex-wrap gap-2">
                {["2x2", "3x3", "5x5", "duo", "full"].map((f) => {
                  const isAvailable = selectedGame.formats.includes(f as never);
                  const active = format === f;
                  return (
                    <button
                      key={f}
                      disabled={!isAvailable}
                      onClick={() => setFormat(f)}
                      className={`chip ${active ? "chip--active" : ""} ${!isAvailable ? "opacity-30 cursor-not-allowed" : ""}`}
                      style={active ? { background: selectedGame.color, borderColor: selectedGame.color } : {}}
                    >
                      {f === "duo" ? "Дуо" : f === "full" ? "Полный" : f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="section-label mb-2">Стиль игры</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: "ranked", label: "Ранкед", emoji: "🏆" },
                  { code: "chill", label: "Чилл", emoji: "😎" },
                  { code: "fun", label: "Фан", emoji: "🎮" },
                ].map((s) => {
                  const active = style === s.code;
                  return (
                    <button
                      key={s.code}
                      onClick={() => setStyle(s.code)}
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

        {/* Casual topics */}
        {category === "casual" && (
          <div className="mb-4">
            <div className="section-label mb-2">Темы</div>
            <div className="flex flex-wrap gap-2">
              {CASUAL_TOPICS.map((t) => {
                const active = selectedTopics.includes(t.code);
                return (
                  <button
                    key={t.code}
                    onClick={() => toggleTopic(t.code)}
                    className={`topic-pill ${active ? "topic-pill--active" : ""}`}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <div className="section-label mb-2">Название комнаты</div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Ищем пятых на ранкед"
            maxLength={50}
            className="w-full px-3 py-2.5 rounded-xl bg-background/40 border border-border focus:border-primary outline-none text-sm transition-colors"
          />
        </div>

        {/* Max players */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="section-label">Игроков</div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
              <Users className="w-3.5 h-3.5" />
              {maxPlayers}
            </div>
          </div>
          <input
            type="range"
            min={2}
            max={5}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10))}
            className="w-full accent-primary"
            style={{ accentColor: "var(--primary)" }}
          />
          <div className="flex justify-between mt-1 px-1">
            {[2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`text-xs font-bold transition-colors ${n === maxPlayers ? "text-primary" : "text-muted-foreground/50"}`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          className="neon-btn w-full"
        >
          {submitting ? "Создаём..." : "Создать комнату"}
        </button>
      </motion.div>
    </motion.div>
  );
}
