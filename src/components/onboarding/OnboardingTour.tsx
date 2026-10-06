"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { haptic } from "@/lib/telegram/haptics";

export interface TourStep {
  /** value of the data-tour attribute on the target element */
  targetId: string;
  title: string;
  description: string;
  /** Preferred tooltip position relative to the target */
  position?: "top" | "bottom" | "left" | "right";
}

interface Props {
  steps: TourStep[];
  onComplete: () => void;
}

interface RectState {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 10;

/**
 * OnboardingTour — interactive step-by-step guide.
 * Renders a dark overlay with a spotlight cut-out around the target
 * element (via data-tour attribute) and an animated tooltip with an
 * arrow pointing at it.
 */
export function OnboardingTour({ steps, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<RectState | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [arrow, setArrow] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const step = steps[stepIndex];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.targetId}"]`) as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });

    // Tooltip placement
    const pos = step.position ?? "bottom";
    const tw = tooltipRef.current?.offsetWidth ?? 280;
    const th = tooltipRef.current?.offsetHeight ?? 140;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;
    let arrowDir = pos;

    if (pos === "bottom") {
      top = r.bottom + PAD + 8;
      left = r.left + r.width / 2 - tw / 2;
      if (top + th > vh - 16) { arrowDir = "top"; top = r.top - PAD - 8 - th; }
    } else if (pos === "top") {
      top = r.top - PAD - 8 - th;
      left = r.left + r.width / 2 - tw / 2;
      if (top < 16) { arrowDir = "bottom"; top = r.bottom + PAD + 8; }
    } else if (pos === "right") {
      left = r.right + PAD + 8;
      top = r.top + r.height / 2 - th / 2;
      if (left + tw > vw - 16) { arrowDir = "left"; left = r.left - PAD - 8 - tw; }
    } else {
      left = r.left - PAD - 8 - tw;
      top = r.top + r.height / 2 - th / 2;
      if (left < 16) { arrowDir = "right"; left = r.right + PAD + 8; }
    }

    // Clamp into viewport
    left = Math.max(16, Math.min(left, vw - tw - 16));
    top = Math.max(16, Math.min(top, vh - th - 16));

    setTooltipPos({ top, left });
    setArrow(arrowDir);
  }, [step]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [measure]);

  useEffect(() => {
    const onResizeOrScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    // Allow layout to settle after step change
    const t = setTimeout(measure, 60);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(t);
    };
  }, [measure]);

  // Lock body scroll during the tour
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!step) return null;

  const next = () => {
    haptic.impact("light");
    if (stepIndex + 1 >= steps.length) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const skip = () => {
    haptic.impact("light");
    onComplete();
  };

  const ArrowIcon =
    arrow === "top" ? ArrowUp : arrow === "bottom" ? ArrowDown : arrow === "left" ? ArrowLeft : ArrowRight;

  const portal = createPortal(
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-[200]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Spotlight cut-out */}
        {rect && (
          <motion.div
            key={`spot-${stepIndex}-${rect.left}-${rect.top}`}
            className="absolute rounded-2xl transition-all duration-300"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(8, 11, 16, 0.88)",
              border: "2px solid var(--primary)",
              boxSizing: "border-box",
            }}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          key={`tip-${stepIndex}`}
          className="absolute w-[min(300px, calc(100vw - 32px))]"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 320, delay: 0.12 }}
        >
          <div className="relative rounded-2xl p-4" style={{ background: "#141b26", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            {/* Arrow */}
            <div
              className="absolute w-3.5 h-3.5 rotate-45"
              style={{
                background: "#141b26",
                borderTop: "1px solid var(--border)",
                borderLeft: "1px solid var(--border)",
                ...(arrow === "top"
                  ? { top: -7, left: "calc(50% - 7px)", borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }
                  : {}),
                ...(arrow === "bottom"
                  ? { bottom: -7, left: "calc(50% - 7px)", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }
                  : {}),
                ...(arrow === "left"
                  ? { left: -7, top: "calc(50% - 7px)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }
                  : {}),
                ...(arrow === "right"
                  ? { right: -7, top: "calc(50% - 7px)", borderTop: "1px solid var(--border)", borderRight: "1px solid var(--border)" }
                  : {}),
              }}
            />

            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {stepIndex + 1}
              </span>
              <h3 className="font-bold text-sm neon-text">{step.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

            {/* Progress + controls */}
            <div className="flex items-center justify-between mt-3.5">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 rounded-full transition-all duration-200"
                    style={{
                      width: i === stepIndex ? 14 : 5,
                      background: i === stepIndex ? "var(--primary)" : "rgba(255,255,255,0.15)",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={skip} className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-1">
                  Пропустить
                </button>
                <button
                  onClick={next}
                  className="neon-btn text-[11px] !py-1.5 !px-3.5 flex items-center gap-1"
                >
                  {stepIndex + 1 >= steps.length ? "Готово" : "Далее"}
                  <ArrowIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );

  return portal;
}
