import type { ReactNode, SVGProps } from "react";
import {
  Dices,
  Drama,
  ShieldHalf,
  CircleHelp,
  Sprout,
  Swords,
  Flame,
  ThumbsUp,
  Crosshair,
  Medal,
  MessagesSquare,
  Skull,
  LogOut,
  MessageCircle,
  Film,
  MoonStar,
  Music,
  Gamepad2,
  Zap,
  Star,
  Syringe,
  User,
} from "lucide-react";

/**
 * Neon icon registry — replaces every boring Unicode emoji in the UI
 * with crisp vector icons that follow the VoiceDeck neon style.
 */

type IconProps = {
  className?: string;
  style?: React.CSSProperties;
};

/* ── Party game glyphs ─────────────────────────────────────────────── */

/** Custom "incognito spy" glyph: fedora hat over a pair of glasses */
export function SpyGlyph({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {/* hat crown */}
      <path d="M7 9.5c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5" />
      {/* hat brim */}
      <path d="M3.5 10.5h17" />
      {/* glasses bridge + lenses */}
      <circle cx="7.5" cy="15.5" r="2.6" />
      <circle cx="16.5" cy="15.5" r="2.6" />
      <path d="M10.1 15.5h3.8" />
      <path d="M4.9 15.5 3.5 12.4M19.1 15.5l1.4-3.1" />
    </svg>
  );
}

export function PartyGameIcon({ code, className, style }: IconProps & { code: string | null | undefined }) {
  switch (code) {
    case "spyfall":
      return <SpyGlyph className={className} style={style} />;
    case "mafia":
      return <Drama className={className} style={style} />;
    case "bunker":
      return <ShieldHalf className={className} style={style} />;
    case "whoami":
      return <CircleHelp className={className} style={style} />;
    default:
      return <Dices className={className} style={style} />;
  }
}

/** Icon for a PartyGameDef.icon key (same as code-based lookup) */
export function PartyIconByKey({ icon, className, style }: IconProps & { icon: string }) {
  return <PartyGameIcon code={icon} className={className} style={style} />;
}

/* ── Skill level glyphs ────────────────────────────────────────────── */

export function SkillIcon({ code, className, style }: IconProps & { code: string | null | undefined }) {
  switch (code) {
    case "casual":
      return <Sprout className={className} style={style} />;
    case "mid":
      return <Swords className={className} style={style} />;
    case "hardcore":
      return <Flame className={className} style={style} />;
    default:
      return <Swords className={className} style={style} />;
  }
}

/* ── Review type glyphs ────────────────────────────────────────────── */

export function ReviewTypeIcon({ type, className, style }: IconProps & { type: string | null | undefined }) {
  switch (type) {
    case "friendly":
      return <ThumbsUp className={className} style={style} />;
    case "good_aim":
      return <Crosshair className={className} style={style} />;
    case "captain":
      return <Medal className={className} style={style} />;
    case "good_chat":
      return <MessagesSquare className={className} style={style} />;
    case "toxic":
      return <Skull className={className} style={style} />;
    case "leaver":
      return <LogOut className={className} style={style} />;
    default:
      return <ThumbsUp className={className} style={style} />;
  }
}

/** Mafia role glyphs (private role cards) */
export function MafiaRoleIcon({ role, className, style }: IconProps & { role: string }) {
  switch (role) {
    case "mafia":
      return <Skull className={className} style={style} />;
    case "sheriff":
      return <Star className={className} style={style} />;
    case "doctor":
      return <Syringe className={className} style={style} />;
    default:
      return <User className={className} style={style} />;
  }
}

/* ── Legacy casual topic glyphs ────────────────────────────────────── */

export function TopicIcon({ code, className, style }: IconProps & { code: string | null | undefined }) {
  switch (code) {
    case "talk":
      return <MessageCircle className={className} style={style} />;
    case "cinema":
      return <Film className={className} style={style} />;
    case "night":
      return <MoonStar className={className} style={style} />;
    case "music":
      return <Music className={className} style={style} />;
    case "games":
      return <Gamepad2 className={className} style={style} />;
    case "tech":
      return <Zap className={className} style={style} />;
    default:
      return <MessageCircle className={className} style={style} />;
  }
}

/* ── Online status dot (replaces 🟢 / ⚪) ───────────────────────────── */

export function OnlineDot({ online = true, className }: { online?: boolean; className?: string }) {
  if (!online) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full bg-gray-500 shrink-0 ${className ?? ""}`}
        style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.08)" }}
      />
    );
  }
  return (
    <span className={`relative inline-flex w-2 h-2 shrink-0 ${className ?? ""}`}>
      <span
        className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60"
        style={{ animationDuration: "2s" }}
      />
      <span
        className="relative inline-flex w-2 h-2 rounded-full bg-green-400"
        style={{ boxShadow: "0 0 6px rgba(74,222,128,0.9)" }}
      />
    </span>
  );
}

/* ── Rank medals (replaces 🥇🥈🥉) ──────────────────────────────────── */

const MEDAL_COLORS: Record<number, { a: string; b: string; ring: string }> = {
  1: { a: "#FFE680", b: "#D4A017", ring: "#FFD700" },
  2: { a: "#E8EDF2", b: "#8C9BA8", ring: "#C0CDD8" },
  3: { a: "#F0B083", b: "#A05F2C", ring: "#CD7F32" },
};

export function RankMedal({ rank, className }: { rank: number; className?: string }) {
  const c = MEDAL_COLORS[rank] ?? MEDAL_COLORS[3];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label={`Место ${rank}`}>
      <defs>
        <linearGradient id={`medal-${rank}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.a} />
          <stop offset="100%" stopColor={c.b} />
        </linearGradient>
      </defs>
      {/* ribbon */}
      <path d="M9 2h3l-1.5 5h-3z" fill={`${c.ring}55`} />
      <path d="M15 2h-3l1.5 5h3z" fill={`${c.ring}88`} />
      {/* medal disc */}
      <circle cx="12" cy="14.5" r="6.5" fill={`url(#medal-${rank})`} stroke={c.ring} strokeWidth="1.2" />
      <circle cx="12" cy="14.5" r="4" fill="none" stroke="rgba(14,20,29,0.35)" strokeWidth="1" />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="900"
        fill="#0e141d"
        fontFamily="inherit"
      >
        {rank}
      </text>
    </svg>
  );
}

/* ── Support ticket type glyphs ────────────────────────────────────── */

export function TicketTypeIcon({ type, className, style }: { type: string; className?: string; style?: React.CSSProperties }) {
  switch (type) {
    case "bug":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className}>
          <rect x="8" y="7" width="8" height="11" rx="4" />
          <path d="M9 7a3 3 0 0 1 6 0M3 13h5M16 13h5M5 8l3.2 2.4M19 8l-3.2 2.4M5.5 18.5 8.8 16M18.5 18.5 15.2 16" />
        </svg>
      );
    case "idea":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.4c.7.6 1 1.6 1 2.6h6c0-1 .3-2 1-2.6A6 6 0 0 0 12 3Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3c-1.5 0-2.8-.3-4-1L3 20l1.3-4.4a8 8 0 0 1-1-3.9A8.4 8.4 0 0 1 11.8 3.4 8.5 8.5 0 0 1 21 11.5Z" />
          <path d="M8.5 10.5h7M8.5 14h4" />
        </svg>
      );
  }
}

/** Wrapping helper for inline nodes (kept for future use) */
export function iconNode(node: ReactNode): ReactNode {
  return node;
}
