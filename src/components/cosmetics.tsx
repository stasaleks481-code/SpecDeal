"use client";

import type { ReactNode } from "react";
import { shopItem, type UserRow } from "@/lib/supabase/client";

/**
 * Cosmetics rendering — avatar frames, gradient nicknames, title chips.
 * Pure presentational helpers shared by header / profile / leaderboard /
 * friends / voice grid. Frame & style definitions live in SHOP_ITEMS.
 */

/** Avatar with an optional equipped frame (gradient ring + glow). */
export function UserAvatar({
  user,
  size,
  className = "",
}: {
  user: {
    first_name: string;
    photo_url?: string | null;
    avatar_frame?: string | null;
  };
  size: number;
  className?: string;
}) {
  const frame = shopItem("frame", user.avatar_frame);
  const inner = Math.max(10, size - (frame ? 6 : 0));

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        padding: frame ? 3 : 0,
        background: frame?.ring ?? "transparent",
        boxShadow: frame?.shadow ?? "none",
        boxSizing: "border-box",
      }}
    >
      <span
        className="rounded-full overflow-hidden flex items-center justify-center bg-[#1b2836] text-[color:var(--primary)] font-bold"
        style={{
          width: inner,
          height: inner,
          fontSize: Math.max(9, inner * 0.42),
          boxShadow: frame ? "0 0 0 1.5px rgba(11,17,26,0.9)" : undefined,
        }}
      >
        {user.photo_url ? (
          <img
            src={user.photo_url}
            alt={user.first_name}
            className="w-full h-full object-cover"
          />
        ) : (
          user.first_name?.[0] ?? "?"
        )}
      </span>
    </span>
  );
}

/** Nickname with an optional equipped gradient style. */
export function UserName({
  user,
  className = "",
  fallback,
}: {
  user: {
    username?: string | null;
    first_name: string;
    name_style?: string | null;
  };
  className?: string;
  /** override display name (e.g. other-user views) */
  fallback?: string;
}) {
  const style = shopItem("name_style", user.name_style);
  const display = fallback ?? (user.username ? `@${user.username}` : user.first_name);
  if (!style) return <span className={className}>{display}</span>;
  return (
    <span
      className={className}
      style={{
        background: style.gradient,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {display}
    </span>
  );
}

/** Small equipped-title chip (gradient pill). */
export function UserTitleChip({
  user,
  className = "",
}: {
  user: { user_title?: string | null };
  className?: string;
}) {
  const item = shopItem("title", user.user_title);
  if (!item) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-[3px] rounded-full ${className}`}
      style={{
        background: item.chipBg ?? "var(--primary)",
        color: item.chipColor ?? "#fff",
        boxShadow: "0 2px 8px -2px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.25) inset",
      }}
    >
      {item.name}
    </span>
  );
}

/** VoiceDeck Coin — the unique currency glyph. */
export function CoinIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="vd-coin-g" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe9a3" />
          <stop offset="0.5" stopColor="#ffd76f" />
          <stop offset="1" stopColor="#ff9d3d" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9.25" fill="url(#vd-coin-g)" stroke="#c9861d" strokeWidth="1.5" />
      <path
        d="M9.4 7.6h4.4a2.8 2.8 0 0 1 0 5.6H9.4m0-5.6v8.8m0-8.8H7.6m1.8 0v8.8m0 0h1.8m0 0h2.6a2.8 2.8 0 0 0 2.66-1.93"
        stroke="#8a5b10"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Quest glyphs — tiny stroke icons matching QUEST_DEFS.icon keys. */
const QUEST_GLYPH_PATHS: Record<string, ReactNode> = {
  login: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M9 12h6m-2.5-2.5L15 12l-2.5 2.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 2M9.5 3h5" />
    </>
  ),
  chat: (
    <>
      <path d="M20 12a8 8 0 1 0-3.1 6.3L20 19.5l-.9-3A7.96 7.96 0 0 0 20 12Z" />
      <path d="M8.5 10.5h7m-7 3.5h4.5" />
    </>
  ),
  plus: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  dices: (
    <>
      <rect x="4" y="4" width="10" height="10" rx="2.5" />
      <rect x="10" y="10" width="10" height="10" rx="2.5" />
      <circle cx="7.2" cy="7.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.8" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.3M18.5 20a6.5 6.5 0 0 0-3.2-5.6" />
    </>
  ),
  star: (
    <>
      <path d="m12 3.6 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8L12 3.6Z" />
    </>
  ),
};

export function QuestGlyph({
  icon,
  className = "",
}: {
  icon: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {QUEST_GLYPH_PATHS[icon] ?? QUEST_GLYPH_PATHS.star}
    </svg>
  );
}
