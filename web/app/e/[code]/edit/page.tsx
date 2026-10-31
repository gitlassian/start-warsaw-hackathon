import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/bars";
import { EventForm } from "@/components/event-form";
import { EventFormSkeleton } from "@/components/skeleton";
import { eventByCode } from "@/lib/server";

async function Content({ params }: PageProps<"/e/[code]/edit">) {
  const { code } = await params;
  const event = await eventByCode(code, "/edit");
  // Only the host edits; the API refuses anyone else too.
  if (!event.is_owner) notFound();
  return (
    <>
      <TopBar back={`/e/${event.code}`} title="Edit event" />
      <EventForm event={event} />
    </>
  );
}

export default function EditEvent(props: PageProps<"/e/[code]/edit">) {
  return (
    <Suspense fallback={<EventFormSkeleton editing />}>
      <Content {...props} />
    </Suspense>
  );
}
