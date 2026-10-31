"use client";

import { useEffect, useRef, useState } from "react";
import "./pile.css";

// Visible layers of the pile, bottom to top; prints deeper than these wait under SLOTS[0].
const SLOTS = [
  { x: "-26%", y: "-6%", r: "-14deg" },
  { x: "24%", y: "-12%", r: "11deg" },
  { x: "-20%", y: "14%", r: "8deg" },
  { x: "18%", y: "16%", r: "-5deg" },
  { x: "-3%", y: "4%", r: "3deg" },
];
const TOP = SLOTS[SLOTS.length - 1];

// Lower prints sit in the shade of the ones above.
const SHADE = [0.82, 0.87, 0.92, 0.96, 1];

// Stock prints (Unsplash License, see public/pile/SOURCES.md); the real album stays behind sign-in.
// Last one is on top when there's no event cover.
const STOCK = [
  "/pile/confetti.webp",
  "/pile/glitter.webp",
  "/pile/laughing.webp",
  "/pile/candles.webp",
  "/pile/toast.webp",
  "/pile/sparklers.webp",
  "/pile/sixteen.webp",
  "/pile/cheers.webp",
  "/pile/hug.webp",
];

const EVERY_MS = 1500;

/** The event's prints tossed on a table, flipping through on their own. Tap to flip sooner. */
export function Pile({ cover, label }: { cover: string | null; label: string }) {
  const photos = cover ? [...STOCK, cover] : STOCK;
  const count = photos.length;
  // order[i] = photo at stack position i (last = top). n counts flips to restart the tuck animation.
  const [{ order, n }, setPile] = useState(() => ({ order: photos.map((_, i) => i), n: 0 }));
  const paused = useRef(false);
  const shuffle = () => setPile((p) => ({ order: [p.order.at(-1)!, ...p.order.slice(0, -1)], n: p.n + 1 }));

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => paused.current || shuffle(), EVERY_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <button
      type="button"
      onClick={shuffle}
      // Holding a finger or pointer on the pile stops it flipping.
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
      aria-label={`${label}. Shuffle the photos`}
      className="photo-pile"
    >
      {/* Fixed DOM order: only positions change, so prints glide instead of re-mounting and re-dropping. */}
      {photos.map((src, photo) => {
        const at = order.indexOf(photo);
        const slot = Math.max(0, at - (count - SLOTS.length));
        return (
          <span
            key={photo}
            data-tuck={n && at === 0 ? (n % 2 ? "a" : "b") : undefined}
            className="print"
            style={
              {
                zIndex: at,
                "--x": SLOTS[slot].x,
                "--y": SLOTS[slot].y,
                "--r": SLOTS[slot].r,
                "--tx": TOP.x,
                "--ty": TOP.y,
                "--tr": TOP.r,
                "--shade": SHADE[slot],
                "--i": slot,
              } as React.CSSProperties
            }
          >
            <span className="print-image">
              <img
                src={src}
                alt=""
                draggable={false}
                fetchPriority={at >= count - 2 ? "high" : "low"}
              />
            </span>
          </span>
        );
      })}
    </button>
  );
}
