"use client";

import { useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Gamepad2, MessageCircle, Plus, Users, Crown } from "lucide-react";
import { CreateRoomModal } from "@/components/games/CreateRoomModal";
import type { UserRow } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";

interface Props {
  user: UserRow;
  children: ReactNode;
}

/**
 * App shell — wraps every page with:
 *  - Top header (StakApp logo + context label + avatar)
 *  - Floating TikTok-style bottom nav (always visible, on every route)
 *  - Create room modal (opened from + button)
 *
 * Active tab is derived from the current pathname, so navigating between
 * pages keeps the nav in sync.
 */
export function AppShell({ user, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [showCreate, setShowCreate] = useState(false);

  // Derive active tab from pathname
  const activeTab: "games" | "friends" | "chill" | "profile" | null = (() => {
    if (pathname === "/") return "games"; // default; /?tab=rooms handled in page
    if (pathname.startsWith("/friends")) return "friends";
    if (pathname.startsWith("/dm")) return "friends";
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/leaderboard")) return "profile";
    if (pathname.startsWith("/users")) return "profile";
    if (pathname.startsWith("/rooms")) return "chill";
    return null;
  })();

  // Context label for header
  const contextLabel = (() => {
    if (pathname === "/") return "LFG Hub";
    if (pathname.startsWith("/friends")) return "Friends";
    if (pathname.startsWith("/dm")) return "Messages";
    if (pathname.startsWith("/profile")) return "Profile";
    if (pathname.startsWith("/leaderboard")) return "Leaderboard";
    if (pathname.startsWith("/users")) return "Player Profile";
    if (pathname.startsWith("/rooms")) return "Room";
    return "StakApp";
  })();

  const navigate = (path: string) => {
    haptic.impact("light");
    if (path !== pathname) {
      router.push(path);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-20 bg-[#0e141d] border-b border-border">
        <div className="neon-strip" />
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--primary)" }}
            >
              <span className="text-[#0e141d] font-black text-sm">S</span>
            </div>
            <div className="text-left">
              <p className="text-base font-bold neon-text leading-tight">StakApp</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">
                {contextLabel}
              </p>
            </div>
          </button>
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-colors ${
              pathname.startsWith("/profile") || pathname.startsWith("/leaderboard") || pathname.startsWith("/users")
                ? "border-primary/40 bg-primary/10"
                : "border-border hover:border-primary/30"
            }`}
          >
            {user.photo_url ? (
              <img src={user.photo_url} alt={user.first_name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                {user.first_name?.[0] ?? "?"}
              </div>
            )}
            <span className="text-xs font-semibold max-w-[80px] truncate">
              {user.username ? user.username : user.first_name}
            </span>
          </button>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto pb-28">
        {children}
      </div>

      {/* Floating bottom navigation — TikTok style, on EVERY page */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 safe-area-inset-bottom pointer-events-none">
        <nav className="max-w-md mx-auto pointer-events-auto">
          <div
            className="flex items-center justify-around rounded-2xl px-2 py-2"
            style={{
              background: "rgba(14, 20, 29, 0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.5)",
            }}
          >
            <TabButton
              active={activeTab === "games"}
              onClick={() => navigate("/")}
              icon={<Gamepad2 className="w-5 h-5" />}
            />

            <TabButton
              active={activeTab === "friends"}
              onClick={() => navigate("/friends")}
              icon={<Users className="w-5 h-5" />}
            />

            {/* Central + button with neon glow */}
            <button
              onClick={() => {
                haptic.impact("medium");
                setShowCreate(true);
              }}
              className="relative flex items-center justify-center shrink-0"
              style={{ width: 48, height: 48 }}
              aria-label="Создать комнату"
            >
              <div
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 50%, #1b2838))",
                  boxShadow:
                    "0 0 16px color-mix(in srgb, var(--primary) 50%, transparent), 0 4px 12px rgba(0,0,0,0.4)",
                }}
              />
              <Plus className="w-6 h-6 text-[#0e141d] relative z-10" strokeWidth={2.5} />
            </button>

            <TabButton
              active={activeTab === "chill"}
              onClick={() => navigate("/?tab=rooms")}
              icon={<MessageCircle className="w-5 h-5" />}
            />

            <TabButton
              active={activeTab === "profile"}
              onClick={() => navigate("/profile")}
              icon={<Crown className="w-5 h-5" />}
            />
          </div>
        </nav>
      </div>

      {/* Create room modal — global, accessible from any page */}
      {showCreate && (
        <CreateRoomModal
          user={user}
          defaultCategory="game"
          defaultGame={null}
          onClose={() => setShowCreate(false)}
          onCreated={(roomId) => {
            setShowCreate(false);
            router.push(`/rooms/${roomId}`);
          }}
        />
      )}
    </main>
  );
}

/**
 * TabButton — icon only (no text label, like TikTok).
 * Active state: LIQUID GLASS indicator.
 *
 * Animation sequence on tab change (3 phases via framer-motion variants):
 *   1. LIFT UP    — current pill slides up (y: -8) + shrinks slightly
 *   2. SLIDE      — pill moves horizontally to new tab position (layoutId)
 *   3. SETTLE     — pill drops down to baseline (y: 0) + grows back
 *
 * The pill is visually "liquid glass": translucent, with backdrop blur,
 * subtle gradient, inner glow, and soft border — mimicking iOS 26 / TikTok.
 */
function TabButton({
  active,
  onClick,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.div
          layoutId="bottom-nav-active"
          className="absolute inset-0 rounded-xl"
          style={{
            // Liquid glass appearance
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
            border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: `
              0 0 12px color-mix(in srgb, var(--primary) 35%, transparent),
              0 4px 12px rgba(0,0,0,0.3),
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
          }}
          initial={{ y: 0, scale: 1, opacity: 0 }}
          animate={{
            y: [0, -10, -10, 0],   // up → hold → down (3 keyframes)
            scale: [1, 0.92, 0.92, 1],  // shrink → hold → grow
            opacity: [1, 1, 1, 1],
          }}
          transition={{
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
            times: [0, 0.25, 0.6, 1],  // up takes 25%, hold to 60%, down 40%
            layout: { type: "spring", damping: 28, stiffness: 350 },
          }}
        />
      )}
      <div className="relative z-10">{icon}</div>
    </button>
  );
}
