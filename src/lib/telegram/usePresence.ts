"use client";

import { useEffect } from "react";

/**
 * usePresence — sets up a heartbeat that pings /api/ping every 30 seconds
 * to keep the user marked as online. On unmount / page hide, calls /api/offline.
 *
 * Usage: const {} = usePresence(userId)
 *
 * Returns nothing — pure side-effect hook.
 */
export function usePresence(userId: number | null) {
  useEffect(() => {
    if (!userId) return;

    let pingInterval: NodeJS.Timeout | null = null;
    let isOnline = true;

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

    const setOffline = async () => {
      if (!isOnline) return;
      isOnline = false;
      try {
        // Use sendBeacon for reliability on page unload
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/offline");
        } else {
          await fetch("/api/offline", {
            method: "POST",
            credentials: "include",
            keepalive: true,
          });
        }
      } catch (err) {
        console.warn("[presence] offline failed:", err);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        isOnline = true;
        ping();
      }
    };

    // Initial ping
    ping();

    // Set up interval — 30 seconds
    pingInterval = setInterval(ping, 30_000);

    // Listen for visibility changes (tab switch / app background)
    document.addEventListener("visibilitychange", onVisibilityChange);

    // On unmount: clean up + mark offline
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      setOffline();
    };
  }, [userId]);
}
