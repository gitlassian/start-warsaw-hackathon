"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/client";

const EVERY_MS = 3000;

/**
 * Keeps the album live: every few seconds asks a tiny endpoint whether a photo was added or removed,
 * and re-renders the page only when the answer changes. Pauses while the tab is hidden or a viewer,
 * sheet or camera is open, so nothing reloads under your finger.
 */
export function LiveUpdates({ eventId, version }: { eventId: number; version: string }) {
  const router = useRouter();
  const shown = useRef(version); // what the page on screen was rendered from
  const requested = useRef(version); // the version we already asked for a refresh to, so one change refreshes once
  useEffect(() => {
    shown.current = version;
  }, [version]);

  useEffect(() => {
    let busy = false;
    async function check() {
      if (busy || document.hidden || document.querySelector("dialog[open]")) return;
      busy = true;
      try {
        const { version: latest } = await api<{ version: string }>(`/api/events/${eventId}/version`);
        if (latest !== shown.current && latest !== requested.current) {
          requested.current = latest;
          router.refresh();
        }
      } catch {
        // offline or signed out: try again on the next tick
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", check); // catch up the moment the tab comes back
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [eventId, router]);

  return null;
}
