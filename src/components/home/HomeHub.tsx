"use client";

import { useState } from "react";
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

  const tabs: { id: HomeSection; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "casual", label: "Общение", icon: <MessageCircle className="w-4 h-4" />, color: "var(--primary)" },
    { id: "pc", label: "ПК-Игры", icon: <Gamepad2 className="w-4 h-4" />, color: "#F7A600" },
    { id: "party", label: "Настольные", icon: <Dices className="w-4 h-4" />, color: "#8B5CF6" },
  ];

  return (
    <div>
      {/* ── Segmented control — 3 equal sections ── */}
      <div className="sticky top-[57px] z-10 bg-[#0e141d]/95 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 py-2.5">
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-border"
            style={{ background: "rgba(255,255,255,0.03)" }}
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
                  }}
                  className={`relative flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    active ? "text-[#0e141d]" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="home-section-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: t.color,
                        boxShadow: `0 0 14px color-mix(in srgb, ${t.color} 45%, transparent)`,
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
