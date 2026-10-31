import { useEffect, useRef, useState } from "react";
import { Calendar, X } from "@/components/icons";
import { day } from "@/components/when";
import { useHydrated } from "@/lib/hydrated";
import "./date-time-field.css";

const ROW = 40; // px; keep in sync with .wheel in globals.css
const DAY = 864e5;
const DAYS_BACK = 30; // hosts sometimes create the album after the party
const DAYS_AHEAD = 365;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const time = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** The next whole hour: a sensible first guess for a start time. */
export function nextHour() {
  const d = new Date();
  d.setMinutes(60, 0, 0);
  return d;
}

/** One iOS-style wheel: native scroll with snapping, so momentum and flicks feel right on a phone. */
function Wheel({
  items,
  index,
  onChange,
  label,
  className = "",
  loop = false,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  label: string;
  className?: string;
  loop?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef(0);

  // Position once on open; after that the user's scrolling is the source of truth.
  useEffect(() => {
    ref.current!.scrollTop = (index + (loop ? items.length : 0)) * ROW;
    return () => window.clearTimeout(settle.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (i: number) => ref.current!.scrollTo({ top: i * ROW, behavior: "smooth" });
  const options = loop ? [...items, ...items, ...items] : items;

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      className={`wheel ${className}`}
      onScroll={() => {
        // shortcut: debounce instead of `scrollend`, which older iOS Safari lacks.
        clearTimeout(settle.current);
        settle.current = window.setTimeout(() => {
          const row = Math.round(ref.current!.scrollTop / ROW);
          const i = loop ? row % items.length : Math.max(0, Math.min(items.length - 1, row));
          if (i !== index) onChange(i);
          // Keep looping wheels in the middle copy, with the same visible neighbours.
          if (loop && (row < items.length || row >= items.length * 2)) {
            ref.current!.scrollTop = (items.length + i) * ROW;
          }
        }, 80);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const row = loop ? Math.round(e.currentTarget.scrollTop / ROW) : index;
        go(Math.max(0, Math.min(options.length - 1, row + (e.key === "ArrowDown" ? 1 : -1))));
      }}
    >
      {options.map((text, row) => (
        <div
          key={row}
          role="option"
          aria-hidden={loop && (row < items.length || row >= items.length * 2) ? true : undefined}
          aria-selected={row === index + (loop ? items.length : 0)}
          className="wheel-item"
          onClick={() => go(row)}
        >
          {text}
        </div>
      ))}
    </div>
  );
}

function Wheels({ value, onChange }: { value: Date; onChange: React.Dispatch<React.SetStateAction<Date | null>> }) {
  const [now] = useState(() => new Date());
  const [first] = useState(() => new Date(midnight(now).getTime() - DAYS_BACK * DAY));

  const days = Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return d;
  });

  // Functional update: two wheels can settle in the same tick.
  const set = (fn: (d: Date) => void) =>
    onChange((prev) => {
      const d = new Date(prev!);
      fn(d);
      return d;
    });

  return (
    <div className="date-time-wheels">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-ui bg-surface" aria-hidden />
      <Wheel
        label="Day"
        className="date-time-day"
        items={days.map((d) => day(d, now))}
        index={Math.max(0, Math.min(days.length - 1, Math.round((midnight(value).getTime() - first.getTime()) / DAY)))}
        onChange={(i) => set((d) => d.setFullYear(days[i].getFullYear(), days[i].getMonth(), days[i].getDate()))}
      />
      <Wheel
        label="Hour"
        className="date-time-number"
        loop
        items={HOURS}
        index={value.getHours()}
        onChange={(i) => set((d) => d.setHours(i))}
      />
      <span className="date-time-separator" aria-hidden>:</span>
      <Wheel
        label="Minute"
        className="date-time-number"
        loop
        items={MINUTES}
        index={Math.floor(value.getMinutes() / 5)}
        onChange={(i) => set((d) => d.setMinutes(i * 5))}
      />
    </div>
  );
}

/** A labelled field that opens a bottom sheet with day / hour / minute wheels. */
export function DateTimeField({
  label,
  value,
  onChange,
  suggest,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  suggest: () => Date;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Date | null>(null);
  const hydrated = useHydrated();

  function open() {
    const d = new Date(value ?? suggest());
    d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    setDraft(d);
    dialog.current?.showModal();
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="px-1 text-sm text-muted">{label}</span>
        <button type="button" onClick={open} aria-label={value ? (hydrated ? `${label}: ${day(value, new Date())}, ${time(value)}` : label) : `${label}: choose`} className="field flex items-center gap-2.5">
          <Calendar size={20} className="shrink-0 text-faint" />
          {value ? (
            <span key={hydrated ? "viewer" : "server"} className="min-w-0 leading-tight tabular-nums" suppressHydrationWarning>
              <span className="block truncate" suppressHydrationWarning>{day(value, new Date())}</span>
              <span className="block truncate text-sm text-muted" suppressHydrationWarning>{time(value)}</span>
            </span>
          ) : (
            <span className="text-faint">Choose</span>
          )}
        </button>
      </div>
      <dialog
        ref={dialog}
        className="sheet"
        aria-label={label}
        onClose={() => setDraft(null)}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-ui bg-line" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{label}</h2>
            <p className="text-muted">Scroll to choose the date and time</p>
          </div>
          <button
            type="button"
            className="btn-icon shrink-0"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} strokeWidth={1.75} />
          </button>
        </div>
        {/* Remounted on every open so the wheels start at the current value. */}
        <div className="mt-3">{draft ? <Wheels value={draft} onChange={setDraft} /> : <div className="h-50" />}</div>
        <button
          type="button"
          className="btn btn-primary mt-4 w-full"
          onClick={() => {
            if (draft) onChange(draft);
            dialog.current?.close();
          }}
        >
          Done
        </button>
      </dialog>
    </>
  );
}
