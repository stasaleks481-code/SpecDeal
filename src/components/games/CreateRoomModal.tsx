"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Search, MessageCircle, Gamepad2, Dices, Mic, MicOff } from "lucide-react";
import {
  GAMES, searchGames, FORMAT_LABELS, PARTY_GAMES, SKILL_LEVELS,
  type UserRow, type GameDef, type SkillLevel, type RoomCategory,
} from "@/lib/supabase/client";
import { SkillIcon, PartyGameIcon } from "@/components/icons";
import { Switch } from "@/components/ui/switch";

interface Props {
  user: UserRow;
  defaultCategory: RoomCategory;
  defaultGame: string | null;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

const CATEGORY_TABS: { id: RoomCategory; label: string; icon: React.ReactNode }[] = [
  { id: "game", label: "Игра", icon: <Gamepad2 className="w-4 h-4" /> },
  { id: "casual", label: "Общение", icon: <MessageCircle className="w-4 h-4" /> },
  { id: "party", label: "Настольная", icon: <Dices className="w-4 h-4" /> },
];

/**
 * CreateRoomModal — unified creation flow for all three sections.
 *
 * Game rooms: searchable game picker, format + style chips, SKILL LEVEL
 *   plate (Casual / Mid / Hardcore), optional title.
 * Casual rooms: clean minimal form — NO topic selection, optional title.
 * Party rooms: table game picker (Spyfall / Mafia / Bunker / Who am I),
 *   auto-mute toggle, players 3-12, optional title.
 */
export function CreateRoomModal({
  user: _user,
  defaultCategory,
  defaultGame,
  onClose,
  onCreated,
}: Props) {
  const [category, setCategory] = useState<RoomCategory>(defaultCategory);
  const [game, setGame] = useState<string>(defaultGame ?? "cs2");
  const [gameQuery, setGameQuery] = useState("");
  const [format, setFormat] = useState<string>("5x5");
  const [style, setStyle] = useState<string>("chill");
  const [skill, setSkill] = useState<SkillLevel | null>(null);
  const [partyGameCode, setPartyGameCode] = useState<string>("bunker");
  const [autoMute, setAutoMute] = useState<boolean>(true);
  const [title, setTitle] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete: filtered games by query
  const filteredGames = useMemo(() => searchGames(gameQuery), [gameQuery]);
  const selectedGame: GameDef | undefined = GAMES.find((g) => g.code === game);
  const selectedPartyGame = PARTY_GAMES.find((g) => g.code === partyGameCode);

  const pickGame = (code: string) => {
    setGame(code);
    setGameQuery("");
    // Reset format to first available of the new game
    const g = GAMES.find((x) => x.code === code);
    if (g && !g.formats.includes(format)) {
      setFormat(g.formats[0]);
    }
  };

  const switchCategory = (c: RoomCategory) => {
    setCategory(c);
    if (c === "party") {
      setMaxPlayers(6);
    } else {
      setMaxPlayers((prev) => Math.min(prev, 5));
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
          skill_level: category === "game" ? skill : null,
          game_type: category === "party" ? partyGameCode : null,
          auto_mute: category === "party" ? autoMute : undefined,
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

  const playersMin = category === "party" ? (selectedPartyGame?.minPlayers ?? 3) : 2;
  const playersMax = category === "party" ? 12 : 5;

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

        {/* Category toggle — 3 sections */}
        <div className="grid grid-cols-3 gap-1 mb-5 p-1 bg-background/40 rounded-xl border border-border">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchCategory(t.id)}
              className={`py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                category === t.id ? "neon-btn" : "text-muted-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── GAME ROOM (PC LFG) ── */}
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
                  <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
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
                  <div className="mb-4">
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

                  {/* Skill level plate — Casual / Mid / Hardcore */}
                  <div>
                    <div className="section-label mb-2">Уровень игры</div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(SKILL_LEVELS) as [SkillLevel, { label: string; short: string; color: string; icon: string; desc: string }][]).map(
                        ([code, meta]) => {
                          const active = skill === code;
                          return (
                            <button
                              key={code}
                              onClick={() => setSkill(active ? null : code)}
                              className="px-3 py-2 rounded-xl border text-left transition-all flex-1 min-w-[96px]"
                              style={{
                                background: active ? `${meta.color}18` : "rgba(255,255,255,0.02)",
                                borderColor: active ? meta.color : "rgba(255,255,255,0.1)",
                                boxShadow: active ? `0 0 12px ${meta.color}40` : "none",
                              }}
                            >
                              <p className="text-xs font-bold flex items-center gap-1" style={{ color: active ? meta.color : undefined }}>
                                <SkillIcon code={meta.icon} className="w-3.5 h-3.5" />
                                {meta.short}
                              </p>
                              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{meta.label}</p>
                            </button>
                          );
                        }
                      )}
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
              Комната появится в разделе «Общение». Любой участник сможет зайти в голос —
              чат доступен как дополнительная панель.
            </p>
          </motion.div>
        )}

        {/* ── PARTY ROOM — table games ── */}
        {category === "party" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 space-y-4"
          >
            <div className="section-label">Выбери игру</div>
            <div className="grid grid-cols-2 gap-2">
              {PARTY_GAMES.map((g) => {
                const active = partyGameCode === g.code;
                return (
                  <button
                    key={g.code}
                    onClick={() => setPartyGameCode(g.code)}
                    className="p-3 rounded-xl border text-left transition-all"
                    style={{
                      background: active ? `${g.color}14` : "rgba(255,255,255,0.02)",
                      borderColor: active ? g.color : "rgba(255,255,255,0.1)",
                      boxShadow: active ? `0 0 14px ${g.color}35` : "none",
                    }}
                  >
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center mb-1.5" style={{ background: `${g.color}22` }}>
                      <PartyGameIcon code={g.code} className="w-4 h-4" style={{ color: g.color }} />
                    </div>
                    <p className="text-xs font-bold" style={{ color: active ? g.color : undefined }}>
                      {g.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                      {g.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Auto-mute toggle (bunker / whoami turn games) */}
            {(selectedPartyGame?.turnSeconds ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: autoMute ? "rgba(63,185,80,0.15)" : "rgba(255,255,255,0.05)" }}
                >
                  {autoMute ? <MicOff className="w-4 h-4 text-green-400" /> : <Mic className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">Авто-мут вне хода</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Микрофоны глушатся автоматически, когда говорит текущий игрок ({selectedPartyGame?.turnSeconds} сек на ход)
                  </p>
                </div>
                <Switch checked={autoMute} onCheckedChange={setAutoMute} />
              </div>
            )}
          </motion.div>
        )}

        {/* Title — optional in all categories */}
        <div className="mb-4">
          <div className="section-label mb-2">
            Название комнаты <span className="normal-case text-muted-foreground/70 font-medium">(необязательно)</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              category === "game" ? "Например: Ищем пятых на ранкед"
              : category === "party" ? `Например: ${selectedPartyGame?.name ?? "Партия"} на ночь`
              : "Например: Ночные разговоры"
            }
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
            min={playersMin}
            max={playersMax}
            value={Math.max(maxPlayers, playersMin)}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10))}
            className="w-full"
            style={{ accentColor: "var(--primary)" }}
          />
          <div className="flex justify-between mt-1 px-1">
            <span className={`text-xs font-bold ${maxPlayers === playersMin ? "text-primary" : "text-muted-foreground/50"}`}>
              {playersMin}
            </span>
            <span className={`text-xs font-bold ${maxPlayers === playersMax ? "text-primary" : "text-muted-foreground/50"}`}>
              {playersMax}
            </span>
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
          {submitting
            ? "Создаём..."
            : category === "game"
            ? "Создать лобби"
            : category === "party"
            ? `Собрать партию${selectedPartyGame ? ` · ${selectedPartyGame.name}` : ""}`
            : "Создать комнату"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
