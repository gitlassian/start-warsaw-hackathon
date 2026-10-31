import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/icons";
import { day, time } from "@/components/when";

const ROW = 40; // px; keep in sync with .wheel in globals.css
const DAY = 864e5;
const DAYS_BACK = 30; // hosts sometimes create the album after the party
const DAYS_AHEAD = 365;
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

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
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef(0);

  // Position once on open; after that the user's scrolling is the source of truth.
  useEffect(() => {
    ref.current!.scrollTop = index * ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (i: number) => ref.current!.scrollTo({ top: i * ROW, behavior: "smooth" });

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
          const i = Math.max(0, Math.min(items.length - 1, Math.round(ref.current!.scrollTop / ROW)));
          if (i !== index) onChange(i);
        }, 80);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        go(Math.max(0, Math.min(items.length - 1, index + (e.key === "ArrowDown" ? 1 : -1))));
      }}
    >
      {items.map((text, i) => (
        <div key={i} role="option" aria-selected={i === index} className="wheel-item" onClick={() => go(i)}>
          {text}
        </div>
      ))}
    </div>
  );
}

function Wheels({ value, onChange }: { value: Date; onChange: React.Dispatch<React.SetStateAction<Date | null>> }) {
  const [now] = useState(() => new Date());
  const [first] = useState(() => new Date(midnight(now).getTime() - DAYS_BACK * DAY));
  const h12 = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ?? false;

  const days = Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: h12 ? 12 : 24 }, (_, i) => (h12 ? String(i || 12) : String(i).padStart(2, "0")));
  const h = value.getHours();

  // Functional update: two wheels can settle in the same tick.
  const set = (fn: (d: Date) => void) =>
    onChange((prev) => {
      const d = new Date(prev!);
      fn(d);
      return d;
    });

  return (
    <div className="relative flex">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-surface" aria-hidden />
      <Wheel
        label="Day"
        className="flex-[2.2] pr-4 text-right"
        items={days.map((d) => day(d, now))}
        index={Math.max(0, Math.min(days.length - 1, Math.round((midnight(value).getTime() - first.getTime()) / DAY)))}
        onChange={(i) => set((d) => d.setFullYear(days[i].getFullYear(), days[i].getMonth(), days[i].getDate()))}
      />
      <Wheel
        label="Hour"
        className="flex-1 text-center"
        items={hours}
        index={h12 ? h % 12 : h}
        onChange={(i) => set((d) => d.setHours(h12 ? i + (d.getHours() >= 12 ? 12 : 0) : i))}
      />
      <Wheel
        label="Minute"
        className="flex-1 text-center"
        items={MINUTES}
        index={Math.floor(value.getMinutes() / 5)}
        onChange={(i) => set((d) => d.setMinutes(i * 5))}
      />
      {h12 ? (
        <Wheel
          label="AM or PM"
          className="flex-1 pl-2 text-left"
          items={["AM", "PM"]}
          index={h >= 12 ? 1 : 0}
          onChange={(i) => set((d) => d.setHours((d.getHours() % 12) + i * 12))}
        />
      ) : null}
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
        <button type="button" onClick={open} aria-label={value ? `${label}: ${day(value, new Date())}, ${time(value)}` : `${label}: choose`} className="field flex items-center gap-2.5">
          <Calendar size={20} className="shrink-0 text-faint" />
          {value ? (
            <span className="min-w-0 leading-tight tabular-nums" suppressHydrationWarning>
              <span className="block truncate">{day(value, new Date())}</span>
              <span className="block truncate text-sm text-muted">{time(value)}</span>
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
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-line" aria-hidden />
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{label}</h2>
            <p className="truncate text-muted">{draft ? `${day(draft, new Date())} · ${time(draft)}` : ""}</p>
          </div>
          <button
            type="button"
            className="-mr-2 h-11 rounded-full px-3 font-semibold text-accent active:bg-surface"
            onClick={() => {
              if (draft) onChange(draft);
              dialog.current?.close();
            }}
          >
            Done
          </button>
        </div>
        {/* Remounted on every open so the wheels start at the current value. */}
        <div className="mt-3">{draft ? <Wheels value={draft} onChange={setDraft} /> : <div className="h-50" />}</div>
      </dialog>
    </>
  );
}
