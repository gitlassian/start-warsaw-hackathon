import { Suspense } from "react";
import Link from "next/link";
import { Pencil } from "@/components/icons";
import { AlbumSkeleton } from "@/components/skeleton";
import { Album } from "@/components/album";
import { EventHeader } from "@/components/event-header";
import { Invite } from "@/components/invite";
import { LiveUpdates } from "@/components/live-updates";
import { Uploader } from "@/components/uploader";
import { When } from "@/components/when";
import { apiGet, eventByCode } from "@/lib/server";
import type { DuplicatesResult, EventDetail } from "@/lib/types";

async function Content({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const { id } = await eventByCode(code);
  const [event, duplicates] = await Promise.all([
    apiGet<EventDetail>(`/api/events/${id}`, `/e/${code}`),
    apiGet<DuplicatesResult>(`/api/events/${id}/duplicates`, `/e/${code}`),
  ]);
  const hidden = duplicates.groups.flatMap((g) => g.drop); // near-duplicates, tucked away by default
  const version = `${event.photos.length}:${Math.max(0, ...event.photos.map((p) => p.id))}`; // same shape as /api/events/{id}/version

  return (
    <>
      <EventHeader
        title={event.title}
        coverUrl={event.cover_url}
        previewUrl={event.preview_url}
        schedule={<When start={event.starts_at} end={event.ends_at} fullRange />}
        actions={
          <div className="flex gap-2">
            {event.is_owner ? (
              <Link href={`/e/${event.code}/edit`} className="btn-icon" aria-label="Edit event">
                <Pencil size={22} strokeWidth={1.75} />
              </Link>
            ) : null}
            <Invite event={event} />
          </div>
        }
      >
        {event.description ? <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{event.description}</p> : null}
      </EventHeader>
      <LiveUpdates eventId={event.id} version={version} />
      <Album eventId={event.id} photos={event.photos} hidden={hidden} upload={<Uploader eventId={event.id} uploadsOpen={event.uploads_open} guestInvitation={event.viewer_is_guest ? event.invite_token ?? event.code : undefined} />} />
    </>
  );
}

// Data streams in behind a skeleton so navigation is instant.
export default function EventPage(props: PageProps<"/e/[code]">) {
  return (
    <Suspense fallback={<AlbumSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
