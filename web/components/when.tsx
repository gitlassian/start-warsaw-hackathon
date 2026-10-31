"use client";

const DAY = 864e5;
const date = new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" });
const dateYear = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
// Viewer's locale for the clock, so 12h/24h follows their phone.
const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const hour = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
// "9 PM" rather than "9:00 PM"; 24h clocks keep the minutes, a bare "21" reads as a number.
export const time = (d: Date) => (clock.resolvedOptions().hour12 && !d.getMinutes() ? hour.format(d) : clock.format(d));

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function day(d: Date, now: Date) {
  const diff = Math.round((midnight(d) - midnight(now)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.getFullYear() === now.getFullYear() ? date.format(d) : dateYear.format(d);
}

/** "Today 19:00 – 23:00", "Sat, Oct 31 22:00 – 03:00", "Today 19:00 – Tomorrow 23:00", "Now · until 23:00". */
export function formatWhen(start: Date, end: Date, now = new Date(), fullRange = false) {
  if (!fullRange && start <= now && now < end) {
    return `Now · until ${midnight(end) === midnight(now) ? time(end) : `${day(end, now)}, ${time(end)}`}`;
  }
  // Same day or overnight (a party till 3am) reads as one evening.
  if (midnight(start) === midnight(end) || (!fullRange && end.getTime() - start.getTime() < DAY)) {
    return `${day(start, now)} ${time(start)} – ${time(end)}`;
  }
  return `${day(start, now)} ${time(start)} – ${day(end, now)} ${time(end)}`;
}

/** Rendered in the viewer's time zone; the server's guess is replaced on hydration. */
export function When({ start, end, fullRange = false }: { start: string; end: string; fullRange?: boolean }) {
  return (
    <time dateTime={start} suppressHydrationWarning>
      {formatWhen(new Date(start), new Date(end), new Date(), fullRange)}
    </time>
  );
}
