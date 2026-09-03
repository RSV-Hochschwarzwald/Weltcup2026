"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShiftPublicStatus } from "@/types/database";

const POLL_INTERVAL_MS = 15000;

/**
 * Hält die öffentliche Schicht-Belegung aktuell:
 *  1. Initialer Ladevorgang direkt aus shift_public_status
 *  2. Live-Updates über den Realtime-Broadcast-Kanal "shift-status"
 *     (siehe supabase/migrations/0004_realtime.sql)
 *  3. Zusätzliches, günstiges Polling als Fallback/Netz, falls
 *     Broadcast auf einem älteren Supabase-Projekt nicht verfügbar ist
 *     oder eine Verbindung kurz unterbrochen war.
 */
export function useLiveShiftStatus(initial: ShiftPublicStatus[]) {
  const [shifts, setShifts] = useState<ShiftPublicStatus[]>(initial);
  const [connectionError, setConnectionError] = useState(false);
  const supabaseRef = useRef(createClient());

  const refetch = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("shift_public_status")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      setConnectionError(true);
      return;
    }
    setConnectionError(false);
    setShifts(data as ShiftPublicStatus[]);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;

    const channel = supabase
      .channel("shift-status")
      .on("broadcast", { event: "status" }, (message) => {
        const updated = message.payload as ShiftPublicStatus;
        setShifts((prev) => prev.map((s) => (s.shift_id === updated.shift_id ? updated : s)));
      })
      .subscribe();

    const interval = setInterval(refetch, POLL_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [refetch]);

  return { shifts, refetch, connectionError };
}
