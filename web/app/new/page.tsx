import { Suspense } from "react";
import { TopBar } from "@/components/bars";
import { EventForm } from "@/components/event-form";
import { EventFormSkeleton } from "@/components/skeleton";
import { apiGet } from "@/lib/server";
import { redirect } from "next/navigation";
import type { User } from "@/lib/types";

// Bounces to sign-in before the form gets filled, not after the cover upload fails.
async function Content() {
  const user = await apiGet<User>("/api/me", "/new");
  if (user.is_guest) redirect("/login?next=/new");
  return <><TopBar back="/" title="New event" /><EventForm /></>;
}

export default function NewEvent() {
  return (
    <Suspense fallback={<EventFormSkeleton />}>
      <Content />
    </Suspense>
  );
}
