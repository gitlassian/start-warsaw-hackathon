import { Suspense } from "react";
import { TopBar } from "@/components/bars";
import { EventForm } from "@/components/event-form";
import { apiGet } from "@/lib/server";

// Bounces to sign-in before the form gets filled, not after the cover upload fails.
async function RequireUser() {
  await apiGet("/api/me", "/new");
  return null;
}

export default function NewEvent() {
  return (
    <>
      <TopBar back="/" title="New event" />
      <EventForm />
      <Suspense>
        <RequireUser />
      </Suspense>
    </>
  );
}
