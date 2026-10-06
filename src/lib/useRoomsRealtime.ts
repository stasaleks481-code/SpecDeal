"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * useRoomsRealtime — keeps room lists in sync without a manual refresh.
 *
 * Subscribes to room_members (join/leave) and rooms (close/delete) changes
 * and fires a debounced `onChange` so lists re-fetch. Both tables are in
 * the supabase_realtime publication.
 *
 * This is the client half of the "ghost 2/2" fix: the moment a member row
 * is deleted (explicit leave, host kick, or server-side stale-heartbeat
 * sweep in /api/ping), every open list updates within ~0.5 s.
 */
export function useRoomsRealtime(enabled: boolean, onChange: () => void) {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 400);
    };

    const channel = supabase
      .channel(`rooms_realtime_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        debounced
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        debounced
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
