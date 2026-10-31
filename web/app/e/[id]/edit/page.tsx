import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/bars";
import { EventForm } from "@/components/event-form";
import { Skeleton } from "@/components/skeleton";
import { apiGet } from "@/lib/server";
import type { EventItem } from "@/lib/types";

async function Content({ params }: PageProps<"/e/[id]/edit">) {
  const { id } = await params;
  const event = await apiGet<EventItem>(`/api/events/${id}`, `/e/${id}/edit`);
  // Only the host edits; the API refuses anyone else too.
  if (!event.is_owner) notFound();
  return (
    <>
      <TopBar back={`/e/${id}`} title="Edit event" />
      <EventForm event={event} />
    </>
  );
}

export default function EditEvent(props: PageProps<"/e/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
