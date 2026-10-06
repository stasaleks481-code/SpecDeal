"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * SplashScreen — the ONE and ONLY loading screen.
 *
 * Design (per feedback):
 *  - Flat background identical to the app/mini-app background (#0e141d)
 *    — no radial vignette, no frame, no glow → fully seamless edges.
 *  - Kept visuals: animated waveform bars, staggered wordmark, progress.
 *  - Removed: logo tile border, all box-shadows/glows, blur filters.
 *
 * Performance:
 *  - Bars animate scaleY (GPU transform) instead of height (layout/paint).
 *  - Progress bar is written directly to the DOM via rAF (zero re-renders).
 *  - Exit is opacity+scale only (no full-screen blur).
 *  - Waits for `ready` (auth resolved) before finishing → single seamless
 *    loading process, no second spinner afterwards.
 */

const LETTERS = "VoiceDeck".split("");
const BAR_HEIGHTS = [0.55, 0.9, 0.7, 1, 0.65, 0.85, 0.5];
const MIN_DURATION = 1400; // ms — minimum splash time
const RAMP_DURATION = 1050; // ms — progress 0 → 85%

export function SplashScreen({
  onDone,
  ready = true,
}: {
  onDone: () => void;
  /** Auth resolved (user set or error) — splash finishes only after this */
  ready?: boolean;
}) {
  const progressRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let finishedAt = 0;

    const tick = (t: number) => {
      const elapsed = t - start;
      let p: number;
      if (elapsed < RAMP_DURATION) {
        // ease-out ramp to 85%
        const x = elapsed / RAMP_DURATION;
        p = 0.85 * (1 - Math.pow(1 - x, 2));
      } else if (readyRef.current && elapsed >= MIN_DURATION) {
        // auth done + minimum time → fill to 100% and finish
        p = 1;
      } else {
        // hold near 85% until ready (tiny breathing motion)
        p = 0.85 + Math.sin((elapsed - RAMP_DURATION) / 400) * 0.012;
      }

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${p})`;
      }

      if (p >= 1) {
        if (!finishedAt) finishedAt = t;
        // small hold at 100% then hand over
        if (t - finishedAt > 220 && !doneRef.current) {
          doneRef.current = true;
          onDone();
          return;
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: "#0e141d" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ── Logo: animated waveform (flat tile, no border / glow) ── */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 16, stiffness: 220, delay: 0.08 }}
        className="relative w-24 h-24 rounded-3xl flex items-center justify-center gap-1.5 mb-7"
        style={{
          background: "linear-gradient(135deg, #1b2838 0%, #12202e 100%)",
        }}
      >
        {BAR_HEIGHTS.map((h, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full"
            style={{
              height: "38%",
              background: "linear-gradient(180deg, #66c0f4, #1a6ea0)",
              transformOrigin: "center",
              willChange: "transform",
            }}
            animate={{ scaleY: [h, Math.max(0.35, 1.15 - h), h] }}
            transition={{
              repeat: Infinity,
              duration: 0.9 + (i % 3) * 0.22,
              ease: "easeInOut",
              delay: i * 0.08,
            }}
          />
        ))}
      </motion.div>

      {/* ── Wordmark: staggered letters (opacity+y only — no blur) ── */}
      <div className="flex items-center h-10 mb-2">
        {LETTERS.map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.3, ease: "easeOut" }}
            className="text-3xl font-black tracking-tight text-[#EAF6FF]"
          >
            {ch}
          </motion.span>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.4 }}
        className="text-[11px] uppercase tracking-[0.3em] text-[#66c0f4]/70 mb-9"
      >
        Voice · Games · Party
      </motion.p>

      {/* ── Progress: rAF-driven scaleX (no React re-renders) ── */}
      <div
        className="w-44 h-1 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          ref={progressRef}
          className="h-full w-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #1a6ea0, #66c0f4)",
            transform: "scaleX(0)",
            transformOrigin: "left center",
            willChange: "transform",
          }}
        />
      </div>
    </motion.div>
  );
}
