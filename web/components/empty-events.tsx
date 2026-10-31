import Link from "next/link";
import { ChevronRight, JoinIcon } from "@/components/icons";
import { EmptyPhotoStack } from "@/components/empty-photo-stack";

export function EmptyEvents() {
  return (
    <section className="empty-state" aria-labelledby="empty-events-title">
      <EmptyPhotoStack />

      <h1 id="empty-events-title" className="empty-state-title">Your first event starts here</h1>
      <p className="empty-state-description">
        Create an event and invite your people. Everyone’s photos, together in one album
      </p>

      <Link href="/join" className="empty-state-join">
        <span className="empty-state-join-icon"><JoinIcon size={22} /></span>
        <span className="empty-state-join-copy">
          <span className="empty-state-join-label">Already invited?</span>
          <span className="empty-state-join-title">Join with a code</span>
        </span>
        <ChevronRight size={20} className="text-faint" />
      </Link>
    </section>
  );
}
