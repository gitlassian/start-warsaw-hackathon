import { Suspense } from "react";
import Link from "next/link";
import { Pencil } from "@/components/icons";
import { Skeleton } from "@/components/skeleton";
import { Album } from "@/components/album";
import { BottomBar, TopBar } from "@/components/bars";
import { Invite } from "@/components/invite";
import { LiveUpdates } from "@/components/live-updates";
import { Uploader } from "@/components/uploader";
import { When } from "@/components/when";
import { apiGet } from "@/lib/server";
import type { EventDetail } from "@/lib/types";

async function Content({ params }: PageProps<"/e/[id]">) {
  const { id } = await params;
  const event = await apiGet<EventDetail>(`/api/events/${id}`, `/e/${id}`);
  const count = event.photos.length;
  const version = `${count}:${Math.max(0, ...event.photos.map((p) => p.id))}`; // same shape as /api/events/{id}/version

  return (
    <>
      <TopBar
        back="/"
        right={
          <div className="flex gap-2">
            {event.is_owner ? (
              <Link href={`/e/${event.id}/edit`} className="btn-icon" aria-label="Edit event">
                <Pencil size={22} strokeWidth={1.75} />
              </Link>
            ) : null}
            <Invite code={event.code} title={event.title} />
          </div>
        }
      />
      <div className="px-4">
        {event.cover_url ? (
          <img src={event.cover_url} alt="" className="aspect-[3/2] w-full rounded-ui border border-line object-cover" />
        ) : null}
        <h1 className="mt-5 text-[26px] leading-tight font-semibold tracking-tight text-balance">{event.title}</h1>
        <p className="mt-1 text-muted">
          <When start={event.starts_at} end={event.ends_at} />
        </p>
        {event.description ? <p className="mt-4 whitespace-pre-line">{event.description}</p> : null}
        <h2 className="mt-6 mb-3 flex items-baseline justify-between font-semibold">
          Photos <span className="text-sm font-normal text-muted tabular-nums">{count || ""}</span>
        </h2>
      </div>
      <LiveUpdates eventId={event.id} version={version} />
      <Album eventId={event.id} photos={event.photos} />
      <BottomBar>
        <Uploader eventId={event.id} />
      </BottomBar>
    </>
  );
}

// Data streams in behind a skeleton so navigation is instant.
export default function EventPage(props: PageProps<"/e/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
