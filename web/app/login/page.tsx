import { Suspense } from "react";
import { GoogleButton } from "@/components/google-button";
import { Pile } from "@/components/pile";
import { When } from "@/components/when";
import { apiPublic } from "@/lib/server";

// Film strips behind the pile: two lanes crossing the table, running opposite ways.
const FILM = [
  { top: "13%", tilt: "-9deg", speed: "18s", dir: "normal" },
  { top: "44%", tilt: "-9deg", speed: "24s", dir: "reverse" },
];

type Teaser = { title: string; starts_at: string; ends_at: string; cover_url: string | null; photos: number; people: number };

function Wordmark() {
  return (
    <div className="flex h-14 shrink-0 items-center">
      <img src="/logo.svg" alt="RollCall" className="h-8 dark:invert" />
    </div>
  );
}

async function Content({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  // A guest who scanned a QR arrives as /login?next=/join/ABC123: show them the event they were invited to.
  const code = typeof next === "string" ? /^\/join\/([A-Za-z0-9]{6})$/.exec(next)?.[1] : undefined;
  const event = code ? await apiPublic<Teaser>(`/api/codes/${code}/teaser`) : null;
  const n = event?.photos ?? 0;

  return (
    <>
      <Pile cover={event?.cover_url ?? null} label={event?.title ?? "Party photos"} />
      <div className="shrink-0 pt-4">
        <h1 className="text-[40px] leading-[1.02] font-bold tracking-[-0.035em] text-balance">
          {event ? (
            n ? (
              <>
                <span className="tabular-nums">{n.toLocaleString("en")}</span> {n === 1 ? "photo" : "photos"} already here.
                <br />
                Add yours.
              </>
            ) : (
              <>
                No photos yet.
                <br />
                Be the first to add one.
              </>
            )
          ) : (
            <>
              One shared photo album
              <br />
              for your event
            </>
          )}
        </h1>
        <p className="mt-3 text-muted">
          {event ? (
            <>
              <span className="font-semibold text-fg">{event.title}</span> ·{" "}
              <When start={event.starts_at} end={event.ends_at} /> · {event.people}{" "}
              {event.people === 1 ? "person" : "people"} in
            </>
          ) : (
            "Create an event and show guests the QR code. Everyone adds their photos, and everyone can see and save them all."
          )}
        </p>
      </div>
      <div className="shrink-0 pt-6">
        <GoogleButton />
      </div>
    </>
  );
}

export default function Login(props: PageProps<"/login">) {
  return (
    <div className="flex flex-1 flex-col px-5 pt-[env(safe-area-inset-top)] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {/* The table the prints land on, edge to edge even on wide screens. */}
      <div className="fixed inset-0 -z-10 bg-surface" aria-hidden />
      <div className="film fixed inset-0 -z-10" aria-hidden>
        {FILM.map((lane) => (
          <div key={lane.top} className="film-lane" style={{ top: lane.top, "--tilt": lane.tilt } as React.CSSProperties}>
            <div className="film-strip" style={{ "--speed": lane.speed, "--dir": lane.dir } as React.CSSProperties} />
          </div>
        ))}
      </div>
      <Wordmark />
      <Suspense fallback={<div className="flex-1" />}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}
