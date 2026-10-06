"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * SplashScreen — VoiceDeck branded loading screen (Steam Neon style).
 *
 * Shows once per app session (sessionStorage flag): neon waveform logo,
 * staggered wordmark, shimmering progress bar, then a smooth fade+scale
 * exit into the main screen.
 */

const LETTERS = "VoiceDeck".split("");

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Fake-smooth progress ~1.8s total
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1800);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(onDone, 150);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, #12202e 0%, #0b1119 55%, #070b10 100%)",
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: "blur(6px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Ambient neon glows */}
      <div
        className="absolute w-[280px] h-[280px] rounded-full pointer-events-none"
        style={{
          top: "22%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(102,192,244,0.14) 0%, transparent 65%)",
          filter: "blur(30px)",
        }}
      />

      {/* ── Logo: waveform bars in a rounded hex tile ── */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
        className="relative w-24 h-24 rounded-3xl flex items-center justify-center gap-1.5 mb-7"
        style={{
          background: "linear-gradient(135deg, #1b2838 0%, #0e141d 100%)",
          border: "1px solid rgba(102, 192, 244, 0.35)",
          boxShadow:
            "0 0 34px rgba(102, 192, 244, 0.35), inset 0 0 22px rgba(102, 192, 244, 0.08)",
        }}
      >
        {[0.55, 0.9, 0.7, 1, 0.65, 0.85, 0.5].map((h, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full"
            style={{
              background: "linear-gradient(180deg, #66c0f4, #1a6ea0)",
              boxShadow: "0 0 8px rgba(102,192,244,0.7)",
            }}
            animate={{ height: [`${h * 38}%`, `${Math.max(20, (1.15 - h) * 44)}%`, `${h * 38}%`] }}
            transition={{
              repeat: Infinity,
              duration: 0.9 + (i % 3) * 0.22,
              ease: "easeInOut",
              delay: i * 0.08,
            }}
          />
        ))}
      </motion.div>

      {/* ── Wordmark: letters stagger in with neon flicker ── */}
      <div className="flex items-center h-10 mb-2">
        {LETTERS.map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.35 + i * 0.055, duration: 0.35, ease: "easeOut" }}
            className="text-3xl font-black tracking-tight"
            style={{
              color: "#EAF6FF",
              textShadow:
                "0 0 12px rgba(102,192,244,0.75), 0 0 34px rgba(102,192,244,0.35)",
            }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.4 }}
        className="text-[11px] uppercase tracking-[0.3em] text-[#66c0f4]/70 mb-9"
      >
        Voice · Games · Party
      </motion.p>

      {/* ── Progress bar ── */}
      <div
        className="w-44 h-1 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg, #1a6ea0, #66c0f4)",
            boxShadow: "0 0 10px rgba(102,192,244,0.8)",
            transition: "width 80ms linear",
          }}
        />
      </div>
    </motion.div>
  );
}
