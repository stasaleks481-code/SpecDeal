"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Dices } from "lucide-react";
import { RoomsTab } from "@/components/rooms/RoomsTab";
import { PartyTab } from "@/components/party/PartyTab";
import { QuestsSheet } from "@/components/quests/QuestsSheet";
import { ShopSheet } from "@/components/shop/ShopSheet";
import { Gift, ChevronRight } from "lucide-react";
import type { UserRow } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";
import { useUser } from "@/lib/UserContext";

export type HomeSection = "casual" | "party";

/**
 * HomeHub — the main screen, chat-first.
 *
 * Priority order (2025 redesign): 1) Общение — casual & dating voice
 * rooms; 2) Настолки — party games. PC LFG moved to the dedicated
 * Steam tab (/pc).
 */
export function HomeHub({ user }: { user: UserRow }) {
  const { updateUser } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = searchParams.get("section");
  const [section, setSection] = useState<HomeSection>(
    initial === "party" ? "party" : "casual"
  );

  // Legacy deep links ?section=pc live on the Steam tab now
  useEffect(() => {
    if (initial === "pc") {
      router.replace("/pc", { scroll: false });
    }
  }, [initial, router]);

  // ── Sticky offset = real header height (measured, not a hardcoded guess).
  // A wrong offset made the tab bar hover below the header with a gap,
  // letting content show through and overlap room cards.
  const [headerH, setHeaderH] = useState(64);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("main > header");
    if (!header) return;
    const update = () => setHeaderH(header.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // ── Smart-hide: tuck the bar under the header while scrolling down so it
  // never covers the list; reveal instantly on scroll up for switching.
  const [barHidden, setBarHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y <= 96) setBarHidden(false);
        else if (delta > 8) setBarHidden(true);
        else if (delta < -8) setBarHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tabs: { id: HomeSection; label: string; icon: React.ReactNode; grad: string; glow: string }[] = [
    { id: "casual", label: "Общение", icon: <MessageCircle className="w-4 h-4" />, grad: "linear-gradient(135deg, #2f7cf6, #7b5cf0)", glow: "rgba(94, 108, 243, 0.5)" },
    { id: "party", label: "Настолки", icon: <Dices className="w-4 h-4" />, grad: "linear-gradient(135deg, #a855f7, #ec4899)", glow: "rgba(204, 84, 200, 0.5)" },
  ];

  // Daily quests entry point on the main screen
  const [questsOpen, setQuestsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/quests", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setReadyCount((data.quests ?? []).filter((q: { ready: boolean }) => q.ready).length);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      {/* ── Daily quests strip — gold, slim, tappable ── */}
      <div className="max-w-md mx-auto px-4 pt-3">
        <button
          onClick={() => {
            haptic.impact("light");
            setQuestsOpen(true);
          }}
          className="w-full room-card !py-2.5 flex items-center gap-2.5 text-left"
          style={{
            background: "linear-gradient(120deg, rgba(255,215,111,0.12), rgba(255,157,61,0.05) 55%, rgba(255,255,255,0.02))",
            borderColor: "rgba(255,200,90,0.3)",
          }}
        >
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(140deg, #ffd76f, #ff9d3d)",
              boxShadow: "0 6px 14px -6px rgba(255,170,80,0.6)",
            }}
          >
            <Gift className="w-4 h-4 text-[#3a2506]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold">Задания дня</span>
            <span className="block text-[10px] text-muted-foreground">
              {readyCount > 0
                ? `${readyCount} ${readyCount === 1 ? "награда готова" : "награды готовы"} к выдаче`
                : "Зарабатывай VoiceDeck Coins"}
            </span>
          </span>
          {readyCount > 0 && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.9)" }}
            />
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        </button>
      </div>

      {/* ── Segmented control — 2 sections (Общение > Настолки).
          Sticks FLUSH under the header (top = measured header height);
          slides under it while scrolling down (smart-hide). ── */}
      <div
        className="sticky z-10 border-b border-border"
        style={{
          top: headerH,
          transform: barHidden ? "translateY(-120%)" : "translateY(0)",
          transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "transform",
          background: "linear-gradient(180deg, rgba(11,17,26,0.96) 0%, rgba(11,17,26,0.88) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-md mx-auto px-4 py-2.5">
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-2xl border border-border"
            style={{
              background: "rgba(255,255,255,0.035)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 20px -12px rgba(0,0,0,0.6)",
            }}
          >
            {tabs.map((t) => {
              const active = section === t.id;
              return (
                <button
                  key={t.id}
                  data-tour={`section-${t.id}`}
                  onClick={() => {
                    haptic.impact("light");
                    setSection(t.id);
                    router.replace(`/?section=${t.id}`, { scroll: false });
                    // Fresh section starts from the top (also re-reveals the bar)
                    window.scrollTo(0, 0);
                  }}
                  className={`relative flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    active ? "text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="home-section-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: t.grad,
                        boxShadow: `0 6px 18px -6px ${t.glow}, 0 1px 0 rgba(255,255,255,0.3) inset`,
                      }}
                      transition={{ type: "spring", damping: 26, stiffness: 320 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {t.icon}
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section content ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.13, ease: "easeOut" }}
        >
          {section === "casual" && <RoomsTab user={user} embedded />}
          {section === "party" && <PartyTab user={user} />}
        </motion.div>
      </AnimatePresence>

      {/* Daily quests sheet */}
      <QuestsSheet
        open={questsOpen}
        onClose={() => setQuestsOpen(false)}
        onOpenShop={() => {
          setQuestsOpen(false);
          setTimeout(() => setShopOpen(true), 220);
        }}
      />
      <ShopSheet
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        onCoinsChange={(coins) => updateUser({ ...user, coins })}
        onEquippedChange={(eq) =>
          updateUser({
            ...user,
            avatar_frame: eq.frame,
            name_style: eq.name_style,
            user_title: eq.title,
          })
        }
      />
    </div>
  );
}
