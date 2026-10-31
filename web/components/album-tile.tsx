"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { Check, Film, Play } from "@/components/icons";
import { ShimmerImage } from "@/components/shimmer-image";
import type { Photo } from "@/lib/types";

export function AlbumTile({ photo, selecting, selected, onOpen, onSelect, onLongPress }: {
  photo: Photo;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const ignoreClick = useRef(false);

  function cancelPress() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  function startPress(e: PointerEvent<HTMLButtonElement>) {
    ignoreClick.current = false;
    cancelPress();
    if (selecting || !e.isPrimary || e.button !== 0) return;
    origin.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    timer.current = setTimeout(() => {
      ignoreClick.current = true;
      cancelPress();
      onLongPress();
    }, 450);
  }

  return (
    <button
      type="button"
      className="album-tile"
      data-selecting={selecting}
      data-selected={selected}
      aria-label={`${photo.kind === "video" ? "Video" : "Photo"} by ${photo.author}`}
      aria-pressed={selecting ? selected : undefined}
      aria-keyshortcuts="Shift+Space"
      onKeyDown={(e) => {
        if (e.key !== " " || !e.shiftKey) return;
        e.preventDefault();
        if (e.repeat) return;
        if (selecting) onSelect();
        else onLongPress();
      }}
      onPointerDown={startPress}
      onPointerMove={(e) => {
        const start = origin.current;
        if (start && (e.pointerId !== start.pointerId || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10)) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (ignoreClick.current && e.detail !== 0) { ignoreClick.current = false; return; }
        ignoreClick.current = false;
        if (selecting) onSelect();
        else onOpen();
      }}
    >
      <span className="album-image">
        {photo.thumb_url ? (
          <ShimmerImage src={photo.thumb_url} alt="" draggable={false} loading="lazy" decoding="async" className="size-full" />
        ) : (
          <Film size={24} strokeWidth={1.5} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-faint" />
        )}
        {photo.kind === "video" ? (
          <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
            <Play size={12} />
          </span>
        ) : null}
        {selecting ? <span className="album-check" aria-hidden>{selected ? <Check size={16} strokeWidth={2.5} /> : null}</span> : null}
      </span>
    </button>
  );
}
