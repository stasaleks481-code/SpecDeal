"use client";

import { useEffect } from "react";

/**
 * usePresence — presence heartbeat.
 *
 * Rules (fixes the "shows online after leaving the mini app" bug):
 *  - While the app is VISIBLE: ping /api/ping every 30 s.
 *  - The moment the app goes HIDDEN (background / closed WebView):
 *      interval is stopped and /api/offline fires via sendBeacon.
 *  - pagehide → sendBeacon offline (covers full WebView kill).
 *  - pageshow after bfcache restore → back online.
 *
 * Even if none of the client events fire (WebView hard kill),
 * the server treats online as "heartbeat fresher than 90 s"
 * (see isEffectivelyOnline) and /api/ping sweeps stale rows.
 */
export function usePresence(userId: number | null) {
  useEffect(() => {
    if (!userId) return;

    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      try {
        await fetch("/api/ping", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.warn("[presence] ping failed:", err);
      }
    };

    const goOffline = () => {
      try {
        // sendBeacon survives WebView teardown better than fetch
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon("/api/offline", new Blob([], { type: "text/plain" }));
        } else {
          void fetch("/api/offline", {
            method: "POST",
            credentials: "include",
            keepalive: true,
          });
        }
      } catch (err) {
        console.warn("[presence] offline failed:", err);
      }
    };

    const startPinging = () => {
      if (pingInterval) return;
      ping();
      pingInterval = setInterval(ping, 30_000);
    };

    const stopPinging = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPinging();
        goOffline();
      } else {
        startPinging();
      }
    };

    const onPageHide = () => {
      stopPinging();
      goOffline();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // restored from bfcache — resume heartbeat
        startPinging();
      }
    };

    startPinging();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      stopPinging();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      goOffline();
    };
  }, [userId]);
}
