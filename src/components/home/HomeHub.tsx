"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Gamepad2, Dices } from "lucide-react";
import { GamesTab } from "@/components/games/GamesTab";
import { RoomsTab } from "@/components/rooms/RoomsTab";
import { PartyTab } from "@/components/party/PartyTab";
import type { UserRow } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";

export type HomeSection = "casual" | "pc" | "party";

/**
 * HomeHub — the balanced main screen.
 *
 * Three EQUAL sections via a segmented control (no direction outweighs
 * another): Casual rooms / PC LFG / Party (table) games.
 */
export function HomeHub({ user }: { user: UserRow }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = (searchParams.get("section") as HomeSection) ?? "casual";
  const [section, setSection] = useState<HomeSection>(
    initial === "pc" || initial === "party" || initial === "casual" ? initial : "casual"
  );

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
    { id: "pc", label: "ПК-Игры", icon: <Gamepad2 className="w-4 h-4" />, grad: "linear-gradient(135deg, #ff9a3d, #ff5e62)", glow: "rgba(255, 122, 80, 0.5)" },
    { id: "party", label: "Настольные", icon: <Dices className="w-4 h-4" />, grad: "linear-gradient(135deg, #a855f7, #ec4899)", glow: "rgba(204, 84, 200, 0.5)" },
  ];

  return (
    <div>
      {/* ── Segmented control — 3 equal sections.
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
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="max-w-md mx-auto px-4 py-2.5">
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-2xl border border-border"
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
      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {section === "casual" && <RoomsTab user={user} embedded />}
          {section === "pc" && <GamesTab user={user} />}
          {section === "party" && <PartyTab user={user} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
