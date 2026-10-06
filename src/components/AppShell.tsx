"use client";

import { useState, useCallback, useRef, useEffect, memo, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, MessageCircle, Plus, Users, Crown, Megaphone, X } from "lucide-react";
import { CreateRoomModal } from "@/components/games/CreateRoomModal";
import { AccountGate } from "@/components/auth/AccountGate";
import type { UserRow, AnnouncementRow } from "@/lib/supabase/client";
import { haptic } from "@/lib/telegram/haptics";
import { useUser } from "@/lib/UserContext";

const GATE_DISMISS_KEY = "stakapp_gate_dismissed";
const ANNOUNCE_DISMISS_KEY = "voicedeck_announce_dismissed";

interface Props {
  user: UserRow;
  children: ReactNode;
}

export function AppShell({ user, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { updateUser } = useUser();
  const [showCreate, setShowCreate] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const isAnonymous = user.account_type === "anonymous";

  // Show the account gate for anonymous users on first render of any page
  // (unless dismissed for this browser)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user.account_type === "anonymous") {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(GATE_DISMISS_KEY) === "1";
      } catch { /* ignore */ }
      setGateOpen(!dismissed);
    } else {
      setGateOpen(false);
    }
  }, [user.account_type]);

  // Dismissed announcement ids (per browser)
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState<AnnouncementRow | null>(null);

  // Fetch active announcement (admin broadcast)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let dismissed: string[] = [];
        try {
          dismissed = JSON.parse(localStorage.getItem(ANNOUNCE_DISMISS_KEY) ?? "[]");
        } catch { /* ignore */ }
        if (cancelled) return;
        setDismissedAnnouncements(dismissed);

        const res = await fetch("/api/announcements", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const first: AnnouncementRow | null = (data.announcements ?? [])[0] ?? null;
        if (first && !dismissed.includes(first.id)) setAnnouncement(first);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismissAnnouncement = useCallback(() => {
    setAnnouncement((current) => {
      if (current) {
        const next = [...dismissedAnnouncements, current.id].slice(-10);
        setDismissedAnnouncements(next);
        try {
          localStorage.setItem(ANNOUNCE_DISMISS_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
      }
      return null;
    });
  }, [dismissedAnnouncements]);

  // Derive active tab from pathname
  const activeTab: "games" | "friends" | "chill" | "profile" | null = (() => {
    if (pathname === "/") return "games";
    if (pathname.startsWith("/friends")) return "friends";
    if (pathname.startsWith("/dm")) return "friends";
    if (pathname.startsWith("/chill")) return "chill";
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/leaderboard")) return "profile";
    if (pathname.startsWith("/users")) return "profile";
    if (pathname.startsWith("/rooms")) return "chill";
    return null;
  })();

  // Track when the active tab changes → triggers "detach" animation
  const [isMoving, setIsMoving] = useState(false);
  const prevTabRef = useRef<string | null>(null);

  // When activeTab changes, set isMoving=true for 400ms → pill "detaches"
  useEffect(() => {
    if (prevTabRef.current !== null && prevTabRef.current !== activeTab) {
      setIsMoving(true);
      const timer = setTimeout(() => setIsMoving(false), 400);
      prevTabRef.current = activeTab;
      return () => clearTimeout(timer);
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);

  // Context label for header
  const contextLabel = (() => {
    if (pathname === "/") return "Voice Hub";
    if (pathname.startsWith("/chill")) return "Chill Zone";
    if (pathname.startsWith("/friends")) return "Friends";
    if (pathname.startsWith("/dm")) return "Messages";
    if (pathname.startsWith("/profile")) return "Profile";
    if (pathname.startsWith("/leaderboard")) return "Leaderboard";
    if (pathname.startsWith("/users")) return "Player Profile";
    if (pathname.startsWith("/rooms")) return "Room";
    return "VoiceDeck";
  })();

  const navigate = useCallback((path: string) => {
    haptic.impact("light");
    if (path !== pathname) {
      router.push(path);
    }
  }, [pathname, router]);

  const handleCreateTap = useCallback(() => {
    haptic.impact("medium");
    if (user.account_type === "anonymous") {
      // Reopen the gate — locked feature
      setGateOpen(true);
      return;
    }
    setShowCreate(true);
  }, [user.account_type]);

  const dismissGate = useCallback(() => {
    setGateOpen(false);
    try {
      localStorage.setItem(GATE_DISMISS_KEY, "1");
    } catch { /* ignore */ }
  }, []);

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
              <span className="text-[#0e141d] font-black text-sm">V</span>
            </div>
            <div className="text-left">
              <p className="text-base font-bold neon-text leading-tight">VoiceDeck</p>
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

      {/* Announcement banner (admin broadcast) */}
      <AnimatePresence>
        {announcement && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="max-w-md mx-auto px-4 mt-2"
          >
            <div
              className="rounded-xl border p-3 pr-9 relative"
              style={{
                background: announcement.kind === "warning" ? "rgba(247,166,0,0.1)" : "rgba(0,240,255,0.06)",
                borderColor: announcement.kind === "warning" ? "rgba(247,166,0,0.4)" : "rgba(0,240,255,0.3)",
              }}
            >
              <div className="flex items-start gap-2">
                <Megaphone className={`w-4 h-4 shrink-0 mt-0.5 ${announcement.kind === "warning" ? "text-amber-400" : "text-primary"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold">{announcement.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{announcement.body}</p>
                </div>
              </div>
              <button
                onClick={dismissAnnouncement}
                className="absolute top-2 right-2 p-1 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Скрыть анонс"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content — window is the single scroll container (nested
          overflow containers break position:sticky coordinates) */}
      <div className="flex-1 pb-28">
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
              tourId="nav-games"
              active={activeTab === "games"}
              onClick={() => navigate("/")}
              icon={<Gamepad2 className="w-5 h-5" />}
              isMoving={isMoving}
            />

            <TabButton
              tourId="nav-friends"
              active={activeTab === "friends"}
              onClick={() => navigate("/friends")}
              icon={<Users className="w-5 h-5" />}
              isMoving={isMoving}
            />

            {/* Central + button with neon glow */}
            <button
              onClick={handleCreateTap}
              className="relative flex items-center justify-center shrink-0"
              style={{ width: 48, height: 48 }}
              aria-label="Создать комнату"
              data-tour="nav-create"
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
              tourId="nav-chill"
              active={activeTab === "chill"}
              onClick={() => navigate("/chill")}
              icon={<MessageCircle className="w-5 h-5" />}
              isMoving={isMoving}
            />

            <TabButton
              tourId="nav-profile"
              active={activeTab === "profile"}
              onClick={() => navigate("/profile")}
              icon={<Crown className="w-5 h-5" />}
              isMoving={isMoving}
            />
          </div>
        </nav>
      </div>

      {/* Create room modal — global, accessible from any page (verified users only) */}
      <AnimatePresence>
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
      </AnimatePresence>

      {/* Anonymous account gate (all pages) */}
      <AnimatePresence>
        {isAnonymous && gateOpen && (
          <AccountGate
            user={user}
            hasTelegramContext={false}
            onUpgraded={(u) => {
              updateUser(u);
              try {
                localStorage.removeItem(GATE_DISMISS_KEY);
              } catch { /* ignore */ }
            }}
            onDismiss={dismissGate}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/**
 * TabButton — icon only, like TikTok.
 *
 * Active state: a FLOATING GLASS PILL that sits ON TOP of the icon.
 * Animation on tab change (isMoving=true):
 *   1. Pill DETACHES — scale up to 1.2
 *   2. SLIDES — layoutId spring physics moves it to new tab position
 *   3. SETTLES — scale back to 1
 */
const TabButton = memo(function TabButton({
  active,
  onClick,
  icon,
  isMoving,
  tourId,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  isMoving: boolean;
  tourId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-tour={tourId}
      className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-150 ${
        active ? "text-white" : "text-muted-foreground"
      }`}
    >
      {active && (
        <motion.div
          layoutId="bottom-nav-active"
          className="absolute inset-0 rounded-full"
          style={{
            // Glass appearance — floating, slightly transparent
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: isMoving
              ? "0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(255, 255, 255, 0.15)"
              : "0 2px 8px rgba(0, 0, 0, 0.3)",
          }}
          // Keyframes: grow → hold → shrink (the "detach" effect)
          animate={{
            scale: isMoving ? [1, 1.2, 1.2, 1] : 1,
          }}
          transition={{
            // Layout (horizontal slide) starts with delay so scale grows first
            layout: { type: "spring", damping: 22, stiffness: 280, delay: 0.08 },
            // Scale animation: detach at 20%, hold till 70%, settle at 100%
            scale: {
              duration: 0.5,
              times: [0, 0.2, 0.7, 1],
              ease: "easeInOut",
            },
          }}
        />
      )}
      <div className="relative z-10">{icon}</div>
    </button>
  );
});
