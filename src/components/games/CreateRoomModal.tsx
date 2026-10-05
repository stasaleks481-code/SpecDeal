"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { GAMES, CASUAL_TOPICS, type UserRow } from "@/lib/supabase/client";

interface Props {
  user: UserRow;
  defaultCategory: "game" | "casual";
  defaultGame: string | null;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export function CreateRoomModal({
  user,
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="glass-card p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold neon-text">Создать комнату</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCategory("game")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              category === "game" ? "neon-btn" : "glass-card"
            }`}
          >
            🎮 Игра
          </button>
          <button
            onClick={() => setCategory("casual")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              category === "casual" ? "neon-btn" : "glass-card"
            }`}
          >
            💬 Общение
          </button>
        </div>

        {/* Game-specific */}
        {category === "game" && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Игра</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {GAMES.map((g) => (
                  <button
                    key={g.code}
                    onClick={() => setGame(g.code)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-2xl transition-all ${
                      game === g.code
                        ? "bg-primary/20 border-2 border-primary"
                        : "glass-card"
                    }`}
                  >
                    {g.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Формат</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {["2x2", "3x3", "5x5", "duo", "full"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      format === f ? "neon-btn" : "glass-card"
                    }`}
                  >
                    {f === "duo" ? "Дуо" : f === "full" ? "Полный" : f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Стиль</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { code: "ranked", label: "Ранкед" },
                  { code: "chill", label: "Чилл" },
                  { code: "fun", label: "Фан" },
                ].map((s) => (
                  <button
                    key={s.code}
                    onClick={() => setStyle(s.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      style === s.code ? "neon-btn" : "glass-card"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Casual topics */}
        {category === "casual" && (
          <div className="mb-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Тема</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CASUAL_TOPICS.map((t) => (
                <button
                  key={t.code}
                  onClick={() => toggleTopic(t.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                    selectedTopics.includes(t.code) ? "neon-btn" : "glass-card"
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Ищем 5ых на CS2"
            maxLength={50}
            className="w-full mt-2 px-3 py-2 rounded-lg bg-input/30 border border-border focus:border-primary outline-none text-sm"
          />
        </div>

        {/* Max players */}
        <div className="mb-5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Макс. игроков: {maxPlayers}
          </label>
          <input
            type="range"
            min={2}
            max={5}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10))}
            className="w-full mt-2 accent-primary"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="neon-btn w-full disabled:opacity-50"
        >
          {submitting ? "Создаём..." : "Создать комнату"}
        </button>
      </motion.div>
    </motion.div>
  );
}
