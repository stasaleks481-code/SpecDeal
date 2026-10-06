"use client";

import { useEffect } from "react";

/**
 * Initializes Telegram WebApp's BackButton to navigate to a given URL when clicked.
 * Used on sub-pages (/rooms/[id], /friends, /dm/[id]) so users can use
 * the native Telegram back button (top-left) instead of our custom one.
 *
 * Automatically shows/hides the BackButton on mount/unmount.
 */
export function useTelegramBackButton(onClick: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tg = (window as unknown as { Telegram?: { WebApp?: { BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void } } } }).Telegram;
    if (!tg?.WebApp?.BackButton) return;

    const backButton = tg.WebApp.BackButton;
    backButton.show();
    backButton.onClick(onClick);

    return () => {
      backButton.offClick(onClick);
      backButton.hide();
    };
  }, [onClick]);
}
