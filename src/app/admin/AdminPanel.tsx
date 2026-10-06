"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, LifeBuoy, Megaphone, LogOut,
  Search, ShieldBan, ShieldCheck, Star, Trash2, X, RefreshCw, Crown,
  Gamepad2, Mic, ChevronLeft, ChevronRight, Eye, Ban, Send, Plus,
  TrendingUp, Activity, MessageCircle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area,
  CartesianGrid,
} from "recharts";

/* ════════════════════════════════════════════════════════════════════
   VoiceDeck Admin — standalone dashboard at /admin
   Access: secret link + password (cookie session, 12 h)
   ════════════════════════════════════════════════════════════════════ */

type Tab = "overview" | "users" | "rooms" | "tickets" | "announcements";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Обзор", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "users", label: "Юзеры", icon: <Users className="w-4 h-4" /> },
  { id: "rooms", label: "Комнаты", icon: <Mic className="w-4 h-4" /> },
  { id: "tickets", label: "Поддержка", icon: <LifeBuoy className="w-4 h-4" /> },
  { id: "announcements", label: "Анонсы", icon: <Megaphone className="w-4 h-4" /> },
];

const api = async (path: string, init?: RequestInit) => {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Ошибка"), { status: res.status });
  return data;
};

/* ── Login screen ──────────────────────────────────────────────────── */

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-card p-6 w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{
              background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 40%, #1b2838))",
              boxShadow: "0 0 24px color-mix(in srgb, var(--primary) 45%, transparent)",
            }}
          >
            <Crown className="w-7 h-7 text-[#0e141d]" />
          </div>
          <h1 className="text-lg font-black neon-text">VoiceDeck Admin</h1>
          <p className="text-[11px] text-muted-foreground mt-1">Вход только для администрации</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль администратора"
          autoFocus
          className="w-full bg-black/30 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/60 transition-colors"
        />
        {error && <p className="text-xs text-red-400 mt-2 text-center">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password}
          className="neon-btn w-full mt-4 text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {busy ? "Проверяем..." : "Войти"}
        </button>
      </motion.form>
    </div>
  );
}

/* ── Shared bits ───────────────────────────────────────────────────── */

function KpiCard({ label, value, sub, accent, icon }: {
  label: string; value: number | string; sub?: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4 relative overflow-hidden">
      <div
        className="absolute -top-3 -right-3 w-14 h-14 rounded-full opacity-20 blur-xl"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>
          {icon}
        </span>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
      </div>
      <p className="text-2xl font-black neon-text tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">{children}</h2>;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const chartTipStyle = {
  background: "#0e141d",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
  color: "#fff",
};

/* ═══════════════════ Overview ═══════════════════ */

interface Stats {
  kpis: Record<string, number>;
  by_type: Record<string, number>;
  charts: {
    signups: { date: string; count: number }[];
    messages: { date: string; count: number }[];
    dms: { date: string; count: number }[];
    rooms: { date: string; count: number }[];
  };
  recent_users: { id: number; username: string | null; first_name: string; photo_url: string | null; account_type: string; created_at: string }[];
  open_tickets: { id: string; type: string; subject: string; status: string; created_at: string; user_id: number }[];
}

function Overview({ stats, onOpenTickets }: { stats: Stats; onOpenTickets: () => void }) {
  const k = stats.kpis;
  const shortDate = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);
  const messages = stats.charts.messages.map((m, i) => ({
    date: shortDate(m.date),
    Сообщения: m.count,
    ЛС: stats.charts.dms[i]?.count ?? 0,
  }));

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Всего юзеров" value={k.users_total} sub={`+${k.users_new_24h} за 24ч · +${k.users_new_7d} за 7д`} accent="#00f0ff" icon={<Users className="w-4 h-4" />} />
        <KpiCard label="Онлайн сейчас" value={k.users_online} sub={`активных за 24ч: ${k.users_active_24h}`} accent="#3FB950" icon={<Activity className="w-4 h-4" />} />
        <KpiCard label="Активных комнат" value={k.rooms_active} sub={`всего создано: ${k.rooms_total}`} accent="#8B5CF6" icon={<Mic className="w-4 h-4" />} />
        <KpiCard label="Сообщений 24ч" value={k.msgs_24h} sub="в комнатах" accent="#F7A600" icon={<MessageCircle className="w-4 h-4" />} />
        <KpiCard label="Отзывов" value={k.reviews_total} accent="#ff3ec9" icon={<Star className="w-4 h-4" />} />
        <KpiCard label="Дружб" value={k.friends_total} accent="#66c0f4" icon={<Users className="w-4 h-4" />} />
        <KpiCard label="Тикетов открытых" value={k.tickets_new} sub={`всего: ${k.tickets_total}`} accent="#FF4655" icon={<LifeBuoy className="w-4 h-4" />} />
        <KpiCard
          label="По типу аккаунта"
          value={`${stats.by_type.telegram ?? 0}/${stats.by_type.steam ?? 0}`}
          sub={`TG / Steam · анонов: ${stats.by_type.anonymous ?? 0}`}
          accent="#229ED9"
          icon={<Users className="w-4 h-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <SectionTitle>Новые юзеры · 14 дней</SectionTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.charts.signups.map((s) => ({ date: shortDate(s.date), Юзеры: s.count }))}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                <Tooltip contentStyle={chartTipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="Юзеры" fill="#00f0ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-4">
          <SectionTitle>Активность сообщений · 14 дней</SectionTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messages}>
                <defs>
                  <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F7A600" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#F7A600" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="dmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={chartTipStyle} />
                <Area type="monotone" dataKey="Сообщения" stroke="#F7A600" fill="url(#msgGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="ЛС" stroke="#00f0ff" fill="url(#dmGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Recent users */}
        <div className="glass-card p-4">
          <SectionTitle>Последние регистрации</SectionTitle>
          <div className="space-y-2">
            {stats.recent_users.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5">
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                    {u.first_name?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {u.username ? `@${u.username}` : u.first_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(u.created_at)}</p>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 border border-border uppercase">
                  {u.account_type}
                </span>
              </div>
            ))}
            {stats.recent_users.length === 0 && <p className="text-xs text-muted-foreground">Пока никого</p>}
          </div>
        </div>

        {/* Open tickets preview */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>Открытые тикеты</SectionTitle>
            {stats.open_tickets.length > 0 && (
              <button onClick={onOpenTickets} className="text-[10px] text-primary hover:underline">
                Все тикеты →
              </button>
            )}
          </div>
          <div className="space-y-2">
            {stats.open_tickets.map((t) => (
              <button key={t.id} onClick={onOpenTickets} className="w-full text-left p-2 rounded-xl bg-white/[0.03] border border-border hover:border-primary/40 transition-colors">
                <p className="text-xs font-semibold truncate">{t.subject}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t.type === "bug" ? "Баг" : t.type === "idea" ? "Идея" : "Вопрос"} · {fmtDate(t.created_at)}
                </p>
              </button>
            ))}
            {stats.open_tickets.length === 0 && <p className="text-xs text-muted-foreground">Открытых тикетов нет</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Users ═══════════════════ */

interface AdminUser {
  id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  account_type: string;
  trust_score: number;
  reviews_count: number;
  matches_count: number;
  coins: number;
  badges: string[];
  is_banned: boolean;
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
}

const BADGE_PRESETS = ["verified", "early", "helper", "moderator", "vip", "founder"];

function UsersTab() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_at");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: AdminUser[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [trustInput, setTrustInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      const d = await api(`/api/admin/users?${params}`);
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [q, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const patchUser = async (id: number, patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    if (!confirm(`Удалить пользователя ${u.first_name} (id ${u.id})? Это необратимо — удалятся его комнаты и сообщения.`)) return;
    if (!confirm(`Точно? Введёшь id вручную на следующем шаге.`)) return;
    const confirmId = prompt(`Введите id пользователя для подтверждения удаления:`);
    if (confirmId !== String(u.id)) { alert("id не совпал — отмена"); return; }
    setBusy(true);
    try {
      await api(`/api/admin/users/${u.id}?confirm=${u.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Поиск: username, имя или ID"
            className="w-full bg-black/30 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary/60"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="bg-black/30 border border-border rounded-xl px-3 py-2.5 text-xs outline-none"
        >
          <option value="created_at">Новые</option>
          <option value="trust_score">Рейтинг</option>
          <option value="last_seen">Активность</option>
          <option value="reviews">Отзывы</option>
        </select>
        <button onClick={load} className="p-2.5 rounded-xl border border-border hover:border-primary/40">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {data && <p className="text-[11px] text-muted-foreground">Всего: {data.total} · страница {page}/{data.pages}</p>}

      {/* List */}
      <div className="space-y-2">
        {loading && !data
          ? [...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.03] animate-pulse" />)
          : data?.users.map((u) => (
              <div key={u.id} className={`glass-card p-3 flex items-center gap-3 ${u.is_banned ? "opacity-60 border-red-500/30" : ""}`}>
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                    {u.first_name?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {u.username ? `@${u.username}` : u.first_name}
                    {u.is_banned && <Ban className="w-3.5 h-3.5 text-red-400" />}
                    <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 border border-border uppercase text-muted-foreground">{u.account_type}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    ID {u.id} · рейтинг {u.trust_score} · отзывов {u.reviews_count} · монет {u.coins ?? 0} · {u.is_online ? "онлайн" : fmtDate(u.last_seen_at)}
                  </p>
                </div>
                <button
                  onClick={() => { setEditing(editing?.id === u.id ? null : u); setTrustInput(String(u.trust_score)); }}
                  className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary"
                  title="Управление"
                >
                  {editing?.id === u.id ? <X className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            ))}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 rounded-lg border border-border disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground">{page} / {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="p-2 rounded-lg border border-border disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit drawer */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 space-y-3 overflow-hidden"
            style={{ borderColor: "rgba(0,240,255,0.25)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">
                {editing.first_name} {editing.last_name ?? ""} <span className="text-muted-foreground font-normal">· ID {editing.id}</span>
              </p>
              <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            {/* Trust score */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">Рейтинг (trust score)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={trustInput}
                  onChange={(e) => setTrustInput(e.target.value)}
                  className="flex-1 bg-black/30 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
                <button
                  disabled={busy}
                  onClick={() => patchUser(editing.id, { trust_score: Number(trustInput) })}
                  className="neon-btn px-4 text-xs flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Star className="w-3.5 h-3.5" /> Применить
                </button>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[+5, +10, +20, -5, -10, -20].map((d) => (
                  <button
                    key={d}
                    disabled={busy}
                    onClick={() => patchUser(editing.id, { trust_score: editing.trust_score + d })}
                    className="text-[10px] px-2 py-1 rounded-lg border border-border hover:border-primary/40 font-bold"
                    style={{ color: d > 0 ? "#3FB950" : "#FF4655" }}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Coins grant */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                VoiceDeck Coins (баланс: {editing.coins ?? 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[+50, +100, +500, +1000, -50, -100].map((d) => (
                  <button
                    key={d}
                    disabled={busy}
                    onClick={() => patchUser(editing.id, { coins_delta: d })}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg border border-border hover:border-[#ffd76f]/50 font-bold"
                    style={{ color: d > 0 ? "#ffd76f" : "#FF4655" }}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Badges */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">Бейджи</p>
              <div className="flex flex-wrap gap-1.5">
                {BADGE_PRESETS.map((b) => {
                  const has = editing.badges.includes(b);
                  return (
                    <button
                      key={b}
                      disabled={busy}
                      onClick={() =>
                        patchUser(editing.id, {
                          badges: has ? editing.badges.filter((x) => x !== b) : [...editing.badges, b],
                        })
                      }
                      className={`text-[10px] px-2 py-1 rounded-lg border font-semibold transition-colors ${
                        has ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ban / delete */}
            <div className="flex gap-2 pt-1">
              <button
                disabled={busy}
                onClick={() => patchUser(editing.id, { is_banned: !editing.is_banned })}
                className={`flex-1 text-xs py-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  editing.is_banned
                    ? "border-green-500/40 text-green-400 hover:bg-green-500/10"
                    : "border-red-500/40 text-red-400 hover:bg-red-500/10"
                }`}
              >
                {editing.is_banned ? <ShieldCheck className="w-4 h-4" /> : <ShieldBan className="w-4 h-4" />}
                {editing.is_banned ? "Разбанить" : "Забанить"}
              </button>
              <button
                disabled={busy}
                onClick={() => deleteUser(editing)}
                className="flex-1 text-xs py-2.5 rounded-xl border border-red-500/40 text-red-400 font-bold flex items-center justify-center gap-1.5 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" /> Удалить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════ Rooms ═══════════════════ */

interface AdminRoom {
  id: string;
  title: string;
  category: string;
  game_name: string | null;
  game_type: string | null;
  skill_level: string | null;
  max_players: number;
  is_active: boolean;
  created_at: string;
  member_count: number;
  host: { id: number; username: string | null; first_name: string } | null;
}

function RoomsTab() {
  const [onlyActive, setOnlyActive] = useState(true);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/api/admin/rooms${onlyActive ? "?active=1" : ""}`);
      setRooms(d.rooms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, method: "PATCH" | "DELETE", body?: Record<string, unknown>) => {
    if (method === "DELETE" && !confirm("Удалить комнату полностью?")) return;
    try {
      await api(`/api/admin/rooms/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOnlyActive(!onlyActive)}
          className={`chip ${onlyActive ? "chip--active" : ""}`}
        >
          {onlyActive ? "Только активные" : "Все комнаты"}
        </button>
        <button onClick={load} className="p-2 rounded-xl border border-border hover:border-primary/40 ml-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-2">
        {loading && rooms.length === 0
          ? [...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.03] animate-pulse" />)
          : rooms.map((r) => (
              <div key={r.id} className={`glass-card p-3 flex items-center gap-3 ${!r.is_active ? "opacity-50" : ""}`}>
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: r.category === "party" ? "rgba(139,92,246,0.2)" : r.category === "casual" ? "rgba(0,240,255,0.15)" : "rgba(247,166,0,0.15)" }}
                >
                  {r.category === "party" ? <Gamepad2 className="w-5 h-5 text-purple-300" /> : r.category === "casual" ? <MessageCircle className="w-5 h-5 text-primary" /> : <Mic className="w-5 h-5 text-amber-400" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.title} <span className="text-[10px] text-muted-foreground">({r.category})</span></p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.member_count}/{r.max_players} · хост {r.host ? (r.host.username ? `@${r.host.username}` : r.host.first_name) : "—"} · {fmtDate(r.created_at)}
                  </p>
                </div>
                {r.is_active ? (
                  <button onClick={() => act(r.id, "PATCH", { is_active: false })} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Закрыть">
                    <Ban className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => act(r.id, "PATCH", { is_active: true })} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Открыть">
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => act(r.id, "DELETE")} className="p-2 rounded-lg bg-white/5 text-muted-foreground hover:text-red-400" title="Удалить">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        {!loading && rooms.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Комнат нет</p>}
      </div>
    </div>
  );
}

/* ═══════════════════ Tickets ═══════════════════ */

interface AdminTicket {
  id: string;
  user_id: number;
  type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  user: { id: number; username: string | null; first_name: string } | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: "Новый", color: "#00f0ff" },
  in_progress: { label: "В работе", color: "#F7A600" },
  resolved: { label: "Решён", color: "#3FB950" },
};

function TicketsTab() {
  const [status, setStatus] = useState("all");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/api/admin/tickets?status=${status}`);
      setTickets(d.tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {[["all", "Все"], ["new", "Новые"], ["in_progress", "В работе"], ["resolved", "Решённые"]].map(([v, label]) => (
          <button key={v} onClick={() => setStatus(v)} className={`chip ${status === v ? "chip--active" : ""}`}>
            {label}
          </button>
        ))}
        <button onClick={load} className="p-2 rounded-xl border border-border hover:border-primary/40 ml-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-3">
        {loading && tickets.length === 0
          ? [...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />)
          : tickets.map((t) => {
              const sm = STATUS_META[t.status] ?? STATUS_META.new;
              return (
                <div key={t.id} className="glass-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{t.subject}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.type === "bug" ? "Баг" : t.type === "idea" ? "Идея" : "Вопрос"} · от{" "}
                        {t.user ? (t.user.username ? `@${t.user.username}` : t.user.first_name) : `ID ${t.user_id}`} · {fmtDate(t.created_at)}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                      style={{ background: `${sm.color}1E`, color: sm.color, border: `1px solid ${sm.color}44` }}
                    >
                      {sm.label}
                    </span>
                  </div>

                  <p className="text-xs text-foreground/85 whitespace-pre-wrap bg-black/25 rounded-xl p-3 border border-border">
                    {t.message}
                  </p>

                  {t.admin_reply && (
                    <div className="text-xs p-3 rounded-xl border" style={{ background: "rgba(63,185,80,0.08)", borderColor: "rgba(63,185,80,0.3)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">Ответ поддержки</p>
                      <p className="whitespace-pre-wrap">{t.admin_reply}</p>
                    </div>
                  )}

                  <textarea
                    value={replyDrafts[t.id] ?? t.admin_reply ?? ""}
                    onChange={(e) => setReplyDrafts({ ...replyDrafts, [t.id]: e.target.value })}
                    placeholder="Ответ пользователю (он увидит его в приложении)..."
                    rows={2}
                    className="w-full bg-black/30 border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-primary/60 resize-none"
                  />

                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      disabled={busyId === t.id}
                      onClick={() => patch(t.id, { admin_reply: replyDrafts[t.id] ?? "", status: "resolved" })}
                      className="neon-btn text-xs px-3 py-2 flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" /> Ответить и закрыть
                    </button>
                    <button
                      disabled={busyId === t.id}
                      onClick={() => patch(t.id, { status: "in_progress" })}
                      className="text-xs px-3 py-2 rounded-xl border border-amber-400/40 text-amber-300 font-bold disabled:opacity-40"
                    >
                      В работу
                    </button>
                    {t.status !== "new" && (
                      <button
                        disabled={busyId === t.id}
                        onClick={() => patch(t.id, { status: "new" })}
                        className="text-xs px-3 py-2 rounded-xl border border-border text-muted-foreground font-bold disabled:opacity-40"
                      >
                        Сбросить
                      </button>
                    )}
                    <button
                      disabled={busyId === t.id}
                      onClick={async () => { if (confirm("Удалить тикет?")) { await api(`/api/admin/tickets/${t.id}`, { method: "DELETE" }); load(); } }}
                      className="text-xs px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-red-400 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
        {!loading && tickets.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Тикетов нет</p>}
      </div>
    </div>
  );
}

/* ═══════════════════ Announcements ═══════════════════ */

interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  kind: string;
  is_active: boolean;
  created_at: string;
}

const KIND_META: Record<string, { label: string; color: string }> = {
  info: { label: "Инфо", color: "#00f0ff" },
  warning: { label: "Важно", color: "#F7A600" },
  update: { label: "Апдейт", color: "#8B5CF6" },
};

function AnnouncementsTab() {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("info");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/api/admin/announcements");
      setItems(d.announcements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, kind }),
      });
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: AdminAnnouncement) => {
    await api(`/api/admin/announcements/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !a.is_active }),
    });
    load();
  };

  const remove = async (a: AdminAnnouncement) => {
    if (!confirm("Удалить анонс?")) return;
    await api(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="glass-card p-4 space-y-3">
        <SectionTitle>Новый анонс (баннер в приложении)</SectionTitle>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок"
          className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/60"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Текст анонса — увидят все пользователи в приложении"
          rows={3}
          className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/60 resize-none"
        />
        <div className="flex gap-1.5">
          {Object.entries(KIND_META).map(([k, meta]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`chip ${kind === k ? "chip--active" : ""}`}
              style={kind === k ? { background: meta.color, borderColor: meta.color, color: "#0e141d" } : {}}
            >
              {meta.label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={create} disabled={busy || title.length < 3 || body.length < 3} className="neon-btn w-full text-sm flex items-center justify-center gap-2 disabled:opacity-40">
          <Plus className="w-4 h-4" /> Опубликовать
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && items.length === 0
          ? <div className="h-16 rounded-2xl bg-white/[0.03] animate-pulse" />
          : items.map((a) => {
              const km = KIND_META[a.kind] ?? KIND_META.info;
              return (
                <div key={a.id} className={`glass-card p-3.5 flex items-start gap-3 ${!a.is_active ? "opacity-50" : ""}`}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${km.color}1E`, color: km.color }}>
                    <Megaphone className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold flex items-center gap-2">
                      {a.title}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: `${km.color}1E`, color: km.color }}>
                        {km.label}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{fmtDate(a.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => toggle(a)} className={`text-[10px] px-2 py-1 rounded-lg border font-bold ${a.is_active ? "border-green-500/40 text-green-400" : "border-border text-muted-foreground"}`}>
                      {a.is_active ? "Активен" : "Скрыт"}
                    </button>
                    <button onClick={() => remove(a)} className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-red-400">
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

/* ═══════════════════ Root panel ═══════════════════ */

export function AdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      await api("/api/admin/session");
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await api("/api/admin/stats"));
    } catch { /* ignore */ } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && tab === "overview" && !stats) loadStats();
  }, [authed, tab, stats, loadStats]);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen" style={{ background: "#0a0f16" }}>
        <LoginScreen onSuccess={() => setAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a0f16" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0e141d]/95 backdrop-blur border-b border-border">
        <div className="neon-strip" />
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Crown className="w-5 h-5 text-[#0e141d]" />
            </div>
            <div>
              <p className="text-sm font-black neon-text leading-tight">VoiceDeck Admin</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Панель управления</p>
            </div>
          </div>
          <button
            onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setAuthed(false); }}
            className="p-2 rounded-xl border border-border hover:border-red-500/40 hover:text-red-400 text-muted-foreground"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                tab === t.id ? "text-[#0e141d]" : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === t.id ? { background: "var(--primary)", boxShadow: "0 0 14px rgba(0,240,255,0.35)" } : {}}
            >
              {t.icon} {t.label}
              {t.id === "tickets" && stats && stats.kpis.tickets_new > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-500 text-white">
                  {stats.kpis.tickets_new}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-4 pb-10">
        {tab === "overview" && (
          statsLoading && !stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />)}
            </div>
          ) : stats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" /> Данные в реальном времени из Supabase
                </p>
                <button onClick={loadStats} className="text-[11px] text-primary flex items-center gap-1 hover:underline">
                  <RefreshCw className={`w-3 h-3 ${statsLoading ? "animate-spin" : ""}`} /> Обновить
                </button>
              </div>
              <Overview stats={stats} onOpenTickets={() => setTab("tickets")} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Не удалось загрузить статистику</p>
          )
        )}
        {tab === "users" && <UsersTab />}
        {tab === "rooms" && <RoomsTab />}
        {tab === "tickets" && <TicketsTab />}
        {tab === "announcements" && <AnnouncementsTab />}
      </main>
    </div>
  );
}
