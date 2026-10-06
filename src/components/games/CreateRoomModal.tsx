"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Search, MessageCircle, Gamepad2 } from "lucide-react";
import { GAMES, searchGames, FORMAT_LABELS, type UserRow, type GameDef } from "@/lib/supabase/client";

interface Props {
  user: UserRow;
  defaultCategory: "game" | "casual";
  defaultGame: string | null;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

/**
 * CreateRoomModal — redesigned creation flow.
 *
 * Game rooms: searchable game picker with autocomplete (no full list dump),
 *   format + style chips, optional title.
 * Casual rooms: clean minimal form — NO topic selection, optional title
 *   (auto-generated server-side when empty).
 */
export function CreateRoomModal({
  user: _user,
  defaultCategory,
  defaultGame,
  onClose,
  onCreated,
}: Props) {
  const [category, setCategory] = useState<"game" | "casual">(defaultCategory);
  const [game, setGame] = useState<string>(defaultGame ?? "cs2");
  const [gameQuery, setGameQuery] = useState("");
  const [format, setFormat] = useState<string>("5x5");
  const [style, setStyle] = useState<string>("chill");
  const [title, setTitle] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete: filtered games by query
  const filteredGames = useMemo(() => searchGames(gameQuery), [gameQuery]);
  const selectedGame: GameDef | undefined = GAMES.find((g) => g.code === game);

  const pickGame = (code: string) => {
    setGame(code);
    setGameQuery("");
    // Reset format to first available of the new game
    const g = GAMES.find((x) => x.code === code);
    if (g && !g.formats.includes(format)) {
      setFormat(g.formats[0]);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          game_name: category === "game" ? game : null,
          game_format: category === "game" ? format : null,
          play_style: category === "game" ? style : null,
          topic_tags: [],
          title: title.trim(), // optional — server generates a default
          max_players: maxPlayers,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.room.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось создать комнату");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ background: "rgba(5, 8, 12, 0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
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
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              category === "game" ? "neon-btn" : "text-muted-foreground"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Игра
          </button>
          <button
            onClick={() => setCategory("casual")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              category === "casual" ? "neon-btn" : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Общение
          </button>
        </div>

        {/* ── GAME ROOM ── */}
        {category === "game" && (
          <div className="space-y-4 mb-4">
            {/* Selected game preview */}
            {selectedGame && (
              <motion.div layout className="flex items-center gap-3 p-3 rounded-xl border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ background: selectedGame.gradient }}>
                  {selectedGame.banner && (
                    <img src={selectedGame.banner} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{selectedGame.fullName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {selectedGame.coop ? "Кооператив" : "Соревновательная"}
                  </p>
                </div>
                <button
                  onClick={() => setGame("")}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Сменить
                </button>
              </motion.div>
            )}

            {/* Game search / picker */}
            <AnimatePresence mode="wait">
              {!selectedGame ? (
                <motion.div
                  key="picker"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="section-label mb-2">Найди игру</div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={gameQuery}
                      onChange={(e) => setGameQuery(e.target.value)}
                      placeholder="Начни вводить название..."
                      autoFocus
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background/40 border border-border focus:border-primary outline-none text-sm transition-colors placeholder:text-muted-foreground/60"
                    />
                  </div>

                  {/* Autocomplete results */}
                  <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                    {filteredGames.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Ничего не найдено по «{gameQuery}»
                      </p>
                    ) : (
                      filteredGames.map((g) => (
                        <motion.button
                          key={g.code}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => pickGame(g.code)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl border border-border hover:border-primary/40 transition-colors text-left"
                          style={{ background: "rgba(255,255,255,0.02)" }}
                        >
                          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0" style={{ background: g.gradient }}>
                            {g.banner && <img src={g.banner} alt="" loading="lazy" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{g.name}</p>
                            <p className="text-[10px] text-muted-foreground">{g.coop ? "Кооператив" : g.formats.length + " формата"}</p>
                          </div>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color, boxShadow: `0 0 6px ${g.color}` }} />
                        </motion.button>
                      ))
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="settings" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                  {/* Format */}
                  <div className="mb-4">
                    <div className="section-label mb-2">Формат</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedGame.formats.map((f) => {
                        const active = format === f;
                        return (
                          <button
                            key={f}
                            onClick={() => setFormat(f)}
                            className={`chip ${active ? "chip--active" : ""}`}
                            style={active ? { background: selectedGame.color, borderColor: selectedGame.color } : {}}
                          >
                            {FORMAT_LABELS[f] ?? f}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Style */}
                  <div>
                    <div className="section-label mb-2">Стиль</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { code: "ranked", label: "Ранкед" },
                        { code: "chill", label: "Чилл" },
                        { code: "fun", label: "Фан" },
                      ].map((s) => {
                        const active = style === s.code;
                        return (
                          <button
                            key={s.code}
                            onClick={() => setStyle(s.code)}
                            className={`chip ${active ? "chip--active" : ""}`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── CASUAL ROOM — clean minimal form (no topics) ── */}
        {category === "casual" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-border p-4"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--primary)/15" }}>
                <MessageCircle className="w-5 h-5 neon-text" />
              </div>
              <div>
                <p className="text-sm font-bold">Голосовая комната общения</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Зайди и поболтай — тема найдётся сама
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Комната появится в разделе «Chill». Любой участник сможет зайти в голос —
              чат доступен как дополнительная панель.
            </p>
          </motion.div>
        )}

        {/* Title — optional in both categories */}
        <div className="mb-4">
          <div className="section-label mb-2">
            Название комнаты <span className="normal-case text-muted-foreground/70 font-medium">(необязательно)</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={category === "game" ? "Например: Ищем пятых на ранкед" : "Например: Ночные разговоры"}
            maxLength={50}
            className="w-full px-3 py-2.5 rounded-xl bg-background/40 border border-border focus:border-primary outline-none text-sm transition-colors placeholder:text-muted-foreground/60"
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
            className="w-full"
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

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Submit */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={submitting || (category === "game" && !selectedGame)}
          className="neon-btn w-full"
        >
          {submitting ? "Создаём..." : category === "game" ? "Создать лобби" : "Создать комнату"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
