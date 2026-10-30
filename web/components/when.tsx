"use client";

const format = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Rendered in the viewer's time zone; the server's guess is replaced on hydration. */
export function When({ start, end }: { start: string; end: string }) {
  return (
    <time dateTime={start} suppressHydrationWarning>
      {format.formatRange(new Date(start), new Date(end))}
    </time>
  );
}
