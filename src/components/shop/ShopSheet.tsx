"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check, ShoppingBag } from "lucide-react";
import {
  SHOP_ITEMS,
  RARITY_META,
  shopItem,
  type CosmeticKind,
  type InventoryRow,
  type ShopItemDef,
} from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";
import { CoinIcon } from "@/components/cosmetics";

/**
 * ShopSheet — VoiceDeck Coin store:
 * avatar frames / nickname styles / titles. Buy with coins,
 * equip instantly. Owned items show «Надеть» / «Снято».
 */

const KIND_TABS: { kind: CosmeticKind; label: string }[] = [
  { kind: "frame", label: "Рамки" },
  { kind: "name_style", label: "Фоны ника" },
  { kind: "title", label: "Титулы" },
];

interface ShopState {
  coins: number;
  equipped: { frame: string | null; name_style: string | null; title: string | null };
  owned: InventoryRow[];
}

export function ShopSheet({
  open,
  onClose,
  onEquippedChange,
  onCoinsChange,
}: {
  open: boolean;
  onClose: () => void;
  onEquippedChange?: (eq: ShopState["equipped"]) => void;
  onCoinsChange?: (coins: number) => void;
}) {
  const [kind, setKind] = useState<CosmeticKind>("frame");
  const [state, setState] = useState<ShopState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stable callback refs — keep load() out of the effect dependency churn
  const onCoinsRef = useRef(onCoinsChange);
  const onEquippedRef = useRef(onEquippedChange);
  useEffect(() => {
    onCoinsRef.current = onCoinsChange;
    onEquippedRef.current = onEquippedChange;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shop", { credentials: "include" });
      if (res.ok) {
        const data: ShopState = await res.json();
        setState(data);
        onCoinsRef.current?.(data.coins);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      load();
    }
  }, [open, load]);

  const isOwned = (item: ShopItemDef) =>
    state?.owned.some((o) => o.kind === item.kind && o.code === item.code) ?? false;
  const isEquipped = (item: ShopItemDef) =>
    state?.equipped[
      item.kind === "frame" ? "frame" : item.kind === "name_style" ? "name_style" : "title"
    ] === item.code;

  const buy = async (item: ShopItemDef) => {
    setBusy(item.code);
    setError(null);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kind: item.kind, code: item.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        haptic.success();
        setState((prev) =>
          prev
            ? {
                ...prev,
                coins: data.coins ?? prev.coins,
                owned: [
                  ...prev.owned,
                  { id: Date.now(), user_id: 0, kind: item.kind, code: item.code, acquired_at: new Date().toISOString() },
                ],
              }
            : prev
        );
        onCoinsRef.current?.(data.coins);
      } else {
        haptic.error();
        setError(
          data.error === "Not enough coins"
            ? "Не хватает монет — выполняй задания дня!"
            : data.error ?? "Ошибка покупки"
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const equip = async (item: ShopItemDef | null) => {
    if (!item) return;
    setBusy(item.code);
    setError(null);
    try {
      const unequip = isEquipped(item);
      const res = await fetch("/api/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kind: item.kind, code: unequip ? null : item.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        haptic.impact("medium");
        setState((prev) => {
          if (!prev) return prev;
          const equipped = { ...prev.equipped };
          if (item.kind === "frame") equipped.frame = unequip ? null : item.code;
          else if (item.kind === "name_style") equipped.name_style = unequip ? null : item.code;
          else equipped.title = unequip ? null : item.code;
          return { ...prev, equipped };
        });
        onEquippedRef.current?.({
          frame:
            item.kind === "frame"
              ? unequip
                ? null
                : item.code
              : state?.equipped.frame ?? null,
          name_style:
            item.kind === "name_style"
              ? unequip
                ? null
                : item.code
              : state?.equipped.name_style ?? null,
          title:
            item.kind === "title"
              ? unequip
                ? null
                : item.code
              : state?.equipped.title ?? null,
        });
      } else {
        haptic.error();
        setError(data.error ?? "Ошибка экипировки");
      }
    } finally {
      setBusy(null);
    }
  };

  const items = SHOP_ITEMS.filter((i) => i.kind === kind);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md rounded-t-3xl flex flex-col"
            style={{
              height: "84vh",
              background: "linear-gradient(180deg, rgba(17,24,35,0.98), rgba(11,17,26,0.99))",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 pb-3 border-b border-border shrink-0">
              <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mb-3" />
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(140deg, rgba(123,92,240,0.3), rgba(236,72,153,0.15))",
                    border: "1px solid rgba(168,85,247,0.4)",
                  }}
                >
                  <ShoppingBag className="w-5 h-5 text-[#c9a2ff]" />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-bold">Магазин VoiceDeck</h2>
                  <p className="text-[10px] text-muted-foreground">
                    Косметика для твоего профиля — выделяйся
                  </p>
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,215,111,0.16), rgba(255,157,61,0.08))",
                    border: "1px solid rgba(255,215,111,0.35)",
                  }}
                >
                  <CoinIcon size={14} />
                  <span className="text-xs font-black text-[#ffd76f]">{state?.coins ?? 0}</span>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Kind tabs */}
              <div
                className="flex gap-1 p-1 rounded-xl border border-border mt-3"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {KIND_TABS.map((t) => (
                  <button
                    key={t.kind}
                    onClick={() => {
                      haptic.impact("light");
                      setKind(t.kind);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                      kind === t.kind ? "neon-btn" : "text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="py-14 text-center text-sm text-muted-foreground">Открываем магазин...</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {items.map((item, idx) => {
                    const rarity = RARITY_META[item.rarity];
                    const owned = isOwned(item);
                    const equipped = isEquipped(item);
                    return (
                      <motion.div
                        key={item.code}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="glass-card overflow-hidden"
                        style={{ borderColor: owned ? rarity.color : undefined }}
                      >
                        {/* Preview */}
                        <div
                          className="h-24 flex items-center justify-center relative"
                          style={{
                            background: `radial-gradient(90px 60px at 50% 30%, ${rarity.glow}, transparent 75%)`,
                          }}
                        >
                          {item.kind === "frame" && (
                            <span
                              className="inline-flex items-center justify-center rounded-full"
                              style={{
                                width: 52,
                                height: 52,
                                padding: 3,
                                background: item.ring,
                                boxShadow: item.shadow,
                              }}
                            >
                              <span
                                className="rounded-full w-full h-full flex items-center justify-center text-lg font-black text-[color:var(--primary)]"
                                style={{ background: "#1b2836", boxShadow: "0 0 0 1.5px rgba(11,17,26,0.9)" }}
                              >
                                A
                              </span>
                            </span>
                          )}
                          {item.kind === "name_style" && (
                            <span
                              className="text-lg font-black"
                              style={{
                                background: item.gradient,
                                WebkitBackgroundClip: "text",
                                backgroundClip: "text",
                                color: "transparent",
                              }}
                            >
                              Никнейм
                            </span>
                          )}
                          {item.kind === "title" && (
                            <span
                              className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                              style={{
                                background: item.chipBg,
                                color: item.chipColor,
                                boxShadow: "0 2px 10px -2px rgba(0,0,0,0.6)",
                              }}
                            >
                              {item.name}
                            </span>
                          )}
                          <span
                            className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{ background: `${rarity.color}22`, color: rarity.color }}
                          >
                            {rarity.label}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="p-2.5 pt-2">
                          <p className="text-xs font-bold truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 h-7 overflow-hidden">
                            {item.desc}
                          </p>
                          {owned ? (
                            <button
                              onClick={() => equip(item)}
                              disabled={busy === item.code}
                              className={`mt-2 w-full py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 ${
                                equipped ? "text-green-400" : "neon-btn"
                              }`}
                              style={
                                equipped
                                  ? { background: "rgba(63,185,80,0.12)", border: "1px solid rgba(63,185,80,0.4)" }
                                  : undefined
                              }
                            >
                              {busy === item.code ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : equipped ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Надето
                                </>
                              ) : (
                                "Надеть"
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => buy(item)}
                              disabled={busy === item.code}
                              className="mt-2 w-full py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-transform text-[#2b1a04]"
                              style={{
                                background: "linear-gradient(135deg, #ffd76f, #ff9d3d)",
                                boxShadow: `0 6px 16px -6px ${rarity.glow}`,
                              }}
                            >
                              {busy === item.code ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CoinIcon size={13} />
                              )}
                              {item.price}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              {error && (
                <p className="text-xs text-red-400 text-center mt-3">{error}</p>
              )}
            </div>

            {/* Footer hint */}
            <div className="p-3.5 pt-2.5 border-t border-border shrink-0">
              <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                <CoinIcon size={12} />
                Монеты капают за задания дня — заглядывай каждый день
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Compact shop entry row (used in profile) */
export function ShopEntry({ onClick, coins }: { onClick: () => void; coins: number }) {
  return (
    <button onClick={onClick} className="room-card w-full flex items-center gap-3 text-left">
      <span
        className="vd-tile w-11 h-11"
        style={{
          background: "linear-gradient(140deg, rgba(123,92,240,0.3), rgba(236,72,153,0.14))",
          borderColor: "rgba(168,85,247,0.35)",
        }}
      >
        <ShoppingBag className="w-5 h-5 text-[#c9a2ff]" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm">Магазин</span>
        <span className="block text-xs text-muted-foreground mt-0.5">
          Рамки, фоны ника и титулы за монеты
        </span>
      </span>
      <span
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
        style={{
          background: "linear-gradient(135deg, rgba(255,215,111,0.16), rgba(255,157,61,0.08))",
          border: "1px solid rgba(255,215,111,0.35)",
        }}
      >
        <CoinIcon size={13} />
        <span className="text-xs font-black text-[#ffd76f]">{coins}</span>
      </span>
    </button>
  );
}

// Re-export for consumers that want to resolve equipped defs for previews
export { shopItem };
