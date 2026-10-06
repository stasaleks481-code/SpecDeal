"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, RotateCcw, Square, Timer, MicOff, Eye, EyeOff, UserCheck,
  Moon, Sun, AlertTriangle, Home,
} from "lucide-react";
import { supabase, partyGame, type UserRow, type GameSessionRow } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";

/**
 * GamePanel — in-room party games UI (voice stays primary).
 *
 * Private data (roles/cards) arrives PRE-sanitized from the server:
 *  - spyfall : you_spy / location
 *  - mafia   : your_role (hidden card, tap to reveal)
 *  - bunker  : catastrophe + your_cards + 30s turn timer + auto-mute
 *  - whoami  : words visible for everyone except their owner + timer
 */

interface Props {
  roomId: string;
  room: {
    id: string;
    host_id: number;
    category: string;
    game_type: string | null;
    game_settings: { auto_mute?: boolean } | null;
    max_players: number;
  };
  user: UserRow;
  memberCount: number;
  inCall: boolean;
}

interface SessionResponse {
  session: (GameSessionRow & { game_type: string }) | null;
  view: Record<string, unknown> | null;
}

function useCountdown(turnEnd: string | null, enabled: boolean) {
  const [left, setLeft] = useState<number>(0);
  useEffect(() => {
    if (!enabled || !turnEnd) {
      return;
    }
    const tick = () => {
      const ms = new Date(turnEnd).getTime() - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [turnEnd, enabled]);
  // Reset the display when the timer is inactive
  if (!enabled || !turnEnd) return 0;
  return left;
}

export function GamePanel({ roomId, room, user, memberCount, inCall }: Props) {
  const [session, setSession] = useState<SessionResponse["session"]>(null);
  const [view, setView] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [myTurn, setMyTurn] = useState(false);
  const prevSpeakerRef = useRef<number | null>(null);

  const isHost = room.host_id === user.id;
  const game = partyGame(room.game_type);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/game`, { credentials: "include" });
      if (res.ok) {
        const data: SessionResponse = await res.json();
        setSession(data.session);
        setView(data.view);
      }
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime sync: any change to this room's game session refetches own view
  useEffect(() => {
    const channel = supabase
      .channel(`game_session_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_sessions", filter: `room_id=eq.${roomId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, load]);

  // Haptic on turn start + auto timer-expiry sync
  const speaker = (view?.speaker as number | null) ?? null;
  const turnEnd = (view?.turn_end as string | null) ?? null;
  const secondsLeft = useCountdown(turnEnd, session?.phase === "playing" && !!turnEnd);

  useEffect(() => {
    setMyTurn(speaker === user.id);
  }, [speaker, user.id]);

  useEffect(() => {
    if (speaker && speaker !== prevSpeakerRef.current) {
      if (speaker === user.id) {
        haptic.impact("heavy");
      } else {
        haptic.impact("light");
      }
    }
    prevSpeakerRef.current = speaker;
  }, [speaker, user.id]);

  useEffect(() => {
    if (session?.phase === "playing" && turnEnd && secondsLeft === 0) {
      // Timer expired — any client may advance (idempotent server-side)
      const t = setTimeout(() => act("sync"), 800);
      return () => clearTimeout(t);
    }
  }, [session?.phase, turnEnd, secondsLeft]);

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setActing(true);
      setError(null);
      try {
        const res = await fetch(`/api/rooms/${roomId}/game`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Ошибка");
          haptic.error();
        } else {
          haptic.impact("medium");
          if (data.session) setSession(data.session);
          await load();
        }
      } catch {
        setError("Ошибка сети");
      } finally {
        setActing(false);
      }
    },
    [roomId, load]
  );

  if (loading) {
    return (
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Загружаем игровую панель...</p>
      </div>
    );
  }

  // ── No active session ──────────────────────────────────────────────
  if (!session || session.phase === "finished") {
    if (!isHost) {
      return (
        <div className="glass-card p-4 text-center">
          <p className="text-xl mb-1.5">{game?.emoji ?? "🎲"}</p>
          <p className="text-sm font-semibold">
            {game?.name ?? "Парти"} · ждём хоста
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Хост запустит игру, когда все соберутся
          </p>
        </div>
      );
    }
    const enough = memberCount >= (game?.minPlayers ?? 3);
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: game?.gradient }}
          >
            {game?.emoji}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Запустить «{game?.name}»</p>
            <p className="text-[11px] text-muted-foreground">
              Игроков в комнате: {memberCount} · минимум {game?.minPlayers ?? 3}
            </p>
          </div>
        </div>
        <button
          onClick={() => act("start")}
          disabled={acting || !enough}
          className="neon-btn w-full text-sm flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Play className="w-4 h-4" fill="currentColor" />
          {enough ? "Начать игру" : `Нужно ещё ${(game?.minPlayers ?? 3) - memberCount}`}
        </button>
        {error && <p className="text-[11px] text-red-300 mt-2 text-center">{error}</p>}
      </div>
    );
  }

  const phase = session.phase as string;
  if (phase !== "playing") return null;

  // ── SPYFALL ────────────────────────────────────────────────────────
  if (session.game_type === "spyfall") {
    const youSpy = Boolean(view?.you_spy);
    const location = view?.location as string | null;
    return (
      <GameShell
        title="Шпион"
        emoji="🕵️"
        color="#8B5CF6"
        hostControls={
          <>
            <PanelBtn onClick={() => act("restart")} disabled={acting} icon={<RotateCcw className="w-3.5 h-3.5" />}>
              Новый раунд
            </PanelBtn>
            <PanelBtn onClick={() => act("stop")} disabled={acting} icon={<Square className="w-3.5 h-3.5" />} danger>
              Завершить
            </PanelBtn>
          </>
        }
        error={error}
      >
        {youSpy ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl text-center"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.5)" }}
          >
            <p className="text-3xl mb-2">🕵️</p>
            <p className="text-base font-black text-purple-300">ТЫ ШПИОН</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              Ты не знаешь локацию. Задавай хитрые вопросы, сливайся с толпой
              и не попадись до конца раунда!
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Локация</p>
            <p className="text-2xl font-black neon-text">{location ?? "???"}</p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Один из вас — Шпион. Задавай вопросы и вычисли его!
            </p>
          </motion.div>
        )}
        <button
          onClick={() => setShowLocations(!showLocations)}
          className="w-full mt-3 text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
        >
          <Eye className="w-3 h-3" />
          {showLocations ? "Скрыть список локаций" : "Список всех локаций"}
        </button>
        <AnimatePresence>
          {showLocations && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-1.5 mt-2 text-[11px]">
                {SPYFALL_LOCATIONS_SHORT.map((l) => (
                  <div key={l} className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-border text-center">
                    {l}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GameShell>
    );
  }

  // ── MAFIA ──────────────────────────────────────────────────────────
  if (session.game_type === "mafia") {
    const role = (view?.your_role as string) ?? "civilian";
    const roleName = (view?.role_name as string) ?? "Мирный житель";
    const phaseDay = (view?.phase as string) === "day";
    const roleMeta: Record<string, { emoji: string; color: string; hint: string }> = {
      mafia: { emoji: "🔪", color: "#DC2626", hint: "Ночью мафия выбирает жертву. Днём притворяйся мирным." },
      sheriff: { emoji: "⭐", color: "#F7A600", hint: "Каждую ночь проверяешь одного игрока — мафия он или нет." },
      doctor: { emoji: "💉", color: "#3FB950", hint: "Каждую ночь можешь спасти одного игрока от мафии." },
      civilian: { emoji: "👤", color: "#66c0f4", hint: "Днём обсуждай и голосуй за подозреваемых." },
    };
    const meta = roleMeta[role] ?? roleMeta.civilian;
    const hostView = view?.host_view as Record<string, string> | null;

    return (
      <GameShell
        title="Мафия"
        emoji="🎭"
        color="#DC2626"
        hostControls={
          <>
            <PanelBtn
              onClick={() => act("phase", { phase: phaseDay ? "night" : "day" })}
              disabled={acting}
              icon={phaseDay ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            >
              {phaseDay ? "Ночь" : "День"}
            </PanelBtn>
            <PanelBtn onClick={() => act("restart")} disabled={acting} icon={<RotateCcw className="w-3.5 h-3.5" />}>
              Заново
            </PanelBtn>
            <PanelBtn onClick={() => act("stop")} disabled={acting} icon={<Square className="w-3.5 h-3.5" />} danger>
              Стоп
            </PanelBtn>
          </>
        }
        error={error}
      >
        {/* Phase indicator */}
        <div
          className="flex items-center justify-center gap-2 py-1.5 rounded-xl mb-3"
          style={{
            background: phaseDay ? "rgba(247, 166, 39, 0.12)" : "rgba(102, 192, 244, 0.08)",
          }}
        >
          {phaseDay ? (
            <><Sun className="w-4 h-4 text-amber-400" /><span className="text-xs font-bold text-amber-300">ГОРОД ПРОСНУЛСЯ — обсуждение</span></>
          ) : (
            <><Moon className="w-4 h-4 text-blue-300" /><span className="text-xs font-bold text-blue-200">ГОРОД ЗАСНУЛ — ночь</span></>
          )}
        </div>

        {/* Private role card */}
        <button
          onClick={() => {
            haptic.impact("light");
            setRoleRevealed(!roleRevealed);
          }}
          className="w-full p-4 rounded-2xl text-center transition-all"
          style={{
            background: roleRevealed ? `${meta.color}14` : "rgba(255,255,255,0.04)",
            border: roleRevealed ? `1px solid ${meta.color}66` : "1px dashed rgba(255,255,255,0.2)",
          }}
        >
          {roleRevealed ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <p className="text-4xl mb-2">{meta.emoji}</p>
              <p className="text-lg font-black" style={{ color: meta.color }}>{roleName}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed px-2">{meta.hint}</p>
            </motion.div>
          ) : (
            <div className="py-3">
              <EyeOff className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">Нажми, чтобы посмотреть роль</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Никто, кроме тебя, её не видит</p>
            </div>
          )}
        </button>

        {/* Host leads the table: full distribution */}
        {isHost && hostView && (
          <div className="mt-3 p-3 rounded-xl border border-amber-400/25" style={{ background: "rgba(247,166,39,0.06)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80 mb-2 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Видит только хост
            </p>
            <HostRoleList hostView={hostView} />
          </div>
        )}
      </GameShell>
    );
  }

  // ── BUNKER ─────────────────────────────────────────────────────────
  if (session.game_type === "bunker") {
    const catastrophe = view?.catastrophe as { name: string; desc: string } | null;
    const bunker = view?.bunker as { name: string; desc: string } | null;
    const myCards = view?.your_cards as Record<string, string> | null;
    const order = (view?.order as number[]) ?? [];
    const turnIndex = (view?.turn_index as number) ?? 0;
    const autoMute = Boolean(view?.auto_mute);
    const hostView = view?.host_view as Record<string, Record<string, string>> | null;
    const total = order.length || 1;
    const progress = ((turnIndex + 1) / total) * 100;
    const timerCritical = secondsLeft > 0 && secondsLeft <= 10;

    const CARD_LABELS: [string, string][] = [
      ["profession", "Профессия"],
      ["health", "Здоровье"],
      ["hobby", "Хобби"],
      ["phobia", "Фобия"],
      ["baggage", "Багаж"],
      ["fact", "Факт"],
    ];

    return (
      <GameShell
        title="Бункер"
        emoji="🏛️"
        color="#D97706"
        hostControls={
          <>
            {isHost && speaker !== user.id && (
              <PanelBtn onClick={() => act("end_turn")} disabled={acting} icon={<UserCheck className="w-3.5 h-3.5" />}>
                Следующий
              </PanelBtn>
            )}
            <PanelBtn onClick={() => act("restart")} disabled={acting} icon={<RotateCcw className="w-3.5 h-3.5" />}>
              Заново
            </PanelBtn>
            <PanelBtn onClick={() => act("stop")} disabled={acting} icon={<Square className="w-3.5 h-3.5" />} danger>
              Стоп
            </PanelBtn>
          </>
        }
        error={error}
      >
        {/* Catastrophe */}
        <div className="p-3 rounded-xl mb-3 flex items-start gap-2.5" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.35)" }}>
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-red-300">Катастрофа: {catastrophe?.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{catastrophe?.desc}</p>
          </div>
        </div>

        {/* Bunker */}
        <div className="p-3 rounded-xl mb-3 flex items-start gap-2.5" style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.35)" }}>
          <Home className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-300">Бункер: {bunker?.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{bunker?.desc}</p>
          </div>
        </div>

        {/* Turn timer */}
        <TurnBar
          order={order}
          turnIndex={turnIndex}
          userId={user.id}
          speaker={speaker}
          secondsLeft={secondsLeft}
          timerCritical={timerCritical}
          progress={progress}
          myTurn={myTurn}
          autoMute={autoMute}
          inCall={inCall}
          onEndTurn={() => act("end_turn")}
          canEndTurn={myTurn || isHost}
          acting={acting}
        />

        {/* My cards */}
        {myCards && (
          <div className="mt-3">
            <p className="section-label mb-2 px-1">Твои характеристики</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CARD_LABELS.map(([key, label]) => (
                <div key={key} className="p-2.5 rounded-xl bg-white/[0.04] border border-border">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="text-[11px] font-semibold mt-0.5 leading-snug">{myCards[key] ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Host sees everyone */}
        {isHost && hostView && (
          <div className="mt-3 p-3 rounded-xl border border-amber-400/25" style={{ background: "rgba(247,166,39,0.06)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80 mb-2 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Все карты (видит хост)
            </p>
            <div className="space-y-1.5">
              {Object.entries(hostView).map(([uid, cards]) => (
                <div key={uid} className="text-[10px] text-muted-foreground">
                  <b className={Number(uid) === speaker ? "text-green-400" : ""}>
                    {Number(uid) === user.id ? "Ты" : `Игрок ${uid}`}
                  </b>{" "}
                  · {cards.profession} · {cards.health}
                </div>
              ))}
            </div>
          </div>
        )}
      </GameShell>
    );
  }

  // ── WHO AM I? ──────────────────────────────────────────────────────
  if (session.game_type === "whoami") {
    const words = (view?.words as Record<string, string>) ?? {};
    const order = (view?.order as number[]) ?? [];
    const turnIndex = (view?.turn_index as number) ?? 0;
    const autoMute = Boolean(view?.auto_mute);
    const total = order.length || 1;
    const progress = ((turnIndex + 1) / total) * 100;
    const timerCritical = secondsLeft > 0 && secondsLeft <= 10;

    return (
      <GameShell
        title="Кто я?"
        emoji="❓"
        color="#0EA5E9"
        hostControls={
          <>
            {isHost && speaker !== user.id && (
              <PanelBtn onClick={() => act("end_turn")} disabled={acting} icon={<UserCheck className="w-3.5 h-3.5" />}>
                Следующий
              </PanelBtn>
            )}
            <PanelBtn onClick={() => act("restart")} disabled={acting} icon={<RotateCcw className="w-3.5 h-3.5" />}>
              Заново
            </PanelBtn>
            <PanelBtn onClick={() => act("stop")} disabled={acting} icon={<Square className="w-3.5 h-3.5" />} danger>
              Стоп
            </PanelBtn>
          </>
        }
        error={error}
      >
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3 px-1">
          У каждого слово «на лбу» — его видно всем, кроме владельца. В свой ход
          задавай вопросы, на которые можно ответить «да» или «нет». Угадаешь — ход переходит дальше.
        </p>

        <TurnBar
          order={order}
          turnIndex={turnIndex}
          userId={user.id}
          speaker={speaker}
          secondsLeft={secondsLeft}
          timerCritical={timerCritical}
          progress={progress}
          myTurn={myTurn}
          autoMute={autoMute}
          inCall={inCall}
          onEndTurn={() => act("end_turn")}
          canEndTurn={myTurn || isHost}
          acting={acting}
        />

        {/* Others' words (mine is hidden) */}
        <div className="mt-3">
          <p className="section-label mb-2 px-1">Слова на «лбах»</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(words).map(([uid, word]) => (
              <div
                key={uid}
                className="p-2.5 rounded-xl text-center"
                style={{
                  background: Number(uid) === speaker ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.04)",
                  border: Number(uid) === speaker ? "1px solid rgba(14,165,233,0.45)" : "1px solid var(--border)",
                }}
              >
                <p className="text-[9px] text-muted-foreground">{Number(uid) === user.id ? "Ты" : `Игрок ${uid}`}</p>
                <p className="text-[11px] font-bold mt-0.5">{word}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            Твоё слово скрыто — его видят остальные 🙈
          </p>
        </div>
      </GameShell>
    );
  }

  return null;
}

// ── Shared pieces ─────────────────────────────────────────────────────

const SPYFALL_LOCATIONS_SHORT = [
  "Казино", "Банк", "Пляж", "Космическая станция", "Метро", "Больница",
  "Отель", "Театр", "Военная база", "Школа", "Цирк", "Ресторан",
  "Самолёт", "Полиция", "Пиратский корабль", "Поезд", "Супермаркет",
  "Посольство", "Киностудия", "Собор", "Подлодка", "Стадион",
  "Ночной клуб", "Лыжный курорт",
];

function GameShell({
  title, emoji, color, children, hostControls, error,
}: {
  title: string;
  emoji: string;
  color: string;
  children: React.ReactNode;
  hostControls: React.ReactNode;
  error: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
      style={{ borderColor: `${color}55`, boxShadow: `0 0 20px ${color}18` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="text-sm font-black" style={{ color }}>{title}</span>
        </div>
        <div className="flex items-center gap-1.5">{hostControls}</div>
      </div>
      {children}
      {error && <p className="text-[11px] text-red-300 mt-2 text-center">{error}</p>}
    </motion.div>
  );
}

function PanelBtn({
  onClick, disabled, icon, children, danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-colors flex items-center gap-1 disabled:opacity-40 ${
        danger ? "text-red-300 border-red-500/30 hover:bg-red-500/10" : "text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function TurnBar({
  order, turnIndex, userId, speaker, secondsLeft, timerCritical,
  progress, myTurn, autoMute, inCall, onEndTurn, canEndTurn, acting,
}: {
  order: number[];
  turnIndex: number;
  userId: number;
  speaker: number | null;
  secondsLeft: number;
  timerCritical: boolean;
  progress: number;
  myTurn: boolean;
  autoMute: boolean;
  inCall: boolean;
  onEndTurn: () => void;
  canEndTurn: boolean;
  acting: boolean;
}) {
  const pos = order.indexOf(userId) + 1;
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: timerCritical ? "rgba(255,70,85,0.5)" : "var(--border)" }}>
      {/* Timer row */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ background: timerCritical ? "rgba(255,70,85,0.1)" : "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Timer className={`w-4 h-4 shrink-0 ${timerCritical ? "text-red-400" : "text-muted-foreground"}`} />
          <span className="text-xs font-bold truncate">
            {myTurn ? (
              <span className="text-green-400">ТВОЙ ХОД — говори!</span>
            ) : speaker ? (
              <>Говорит игрок {speaker === userId ? "Ты" : `#${speaker}`}</>
            ) : (
              "Ожидание..."
            )}
          </span>
        </div>
        <span
          className="text-lg font-black tabular-nums shrink-0"
          style={{ color: timerCritical ? "#FF4655" : undefined }}
        >
          {secondsLeft > 0 ? `${secondsLeft}с` : "—"}
        </span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #0EA5E9, #38bdf8)",
            boxShadow: "0 0 8px rgba(14,165,233,0.5)",
          }}
        />
      </div>

      {/* Turn order chips */}
      <div className="flex gap-1 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
        {order.map((uid, i) => (
          <span
            key={uid}
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border"
            style={{
              background: i === turnIndex ? "#0EA5E9" : uid === userId ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)",
              color: i === turnIndex ? "#0e141d" : undefined,
              borderColor: i === turnIndex ? "#0EA5E9" : "var(--border)",
              boxShadow: i === turnIndex ? "0 0 8px rgba(14,165,233,0.5)" : "none",
            }}
          >
            {uid === userId ? "ТЫ" : i + 1}
          </span>
        ))}
      </div>

      {/* Auto-mute hint + end turn */}
      <div className="px-3 pb-3 space-y-2">
        {autoMute && !myTurn && (
          <p className="text-[10px] text-amber-300/80 flex items-center gap-1.5">
            <MicOff className="w-3 h-3" />
            {inCall ? "Твой микрофон заглушен на время чужого хода" : "Авто-мут активен (зайди в голос)"}
          </p>
        )}
        {canEndTurn && (
          <button
            onClick={onEndTurn}
            disabled={acting}
            className="neon-btn w-full text-xs py-2.5"
          >
            Завершить ход
          </button>
        )}
      </div>
    </div>
  );
}

function HostRoleList({ hostView }: { hostView: Record<string, string> }) {
  const labels: Record<string, string> = {
    mafia: "🔪 Мафия",
    sheriff: "⭐ Шериф",
    doctor: "💉 Доктор",
    civilian: "👤 Мирный",
  };
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {Object.entries(hostView).map(([uid, role]) => (
        <div key={uid} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] border border-border">
          Игрок {uid}: <b>{labels[role] ?? role}</b>
        </div>
      ))}
    </div>
  );
}
