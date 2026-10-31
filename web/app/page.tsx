import { Suspense } from "react";
import { EventsSkeleton } from "@/components/skeleton";
import { ShimmerImage } from "@/components/shimmer-image";
import Link from "next/link";
import { ChevronRight, Images, JoinIcon, Plus } from "@/components/icons";
import { Account } from "@/components/account";
import { BottomBar, TopBar } from "@/components/bars";
import { EmptyEvents } from "@/components/empty-events";
import { When } from "@/components/when";
import { apiGet } from "@/lib/server";
import type { EventItem, User } from "@/lib/types";

async function Content() {
  const [me, events] = await Promise.all([
    apiGet<User>("/api/me", "/"),
    apiGet<EventItem[]>("/api/events", "/"),
  ]);

  return (
    <>
      <TopBar divider title={<img src="/logo.svg" alt="RollCall" className="-ml-1 h-8 dark:invert" />} right={<Account user={me} />} />
      {events.length ? (
        <ul className="flex flex-col px-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/e/${e.code}`} className="flex items-center gap-3 rounded-ui p-2 active:bg-surface">
                {e.preview_url ? (
                  <ShimmerImage src={e.preview_url} alt="" className="size-14 shrink-0 rounded-ui border border-line" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-ui bg-surface text-faint">
                    <Images size={22} strokeWidth={1.5} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="block truncate text-sm text-muted">
                    <When start={e.starts_at} end={e.ends_at} />
                  </span>
                </span>
                <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyEvents />
      )}
      <BottomBar>
        {events.length ? (
          <Link href="/join" className="btn btn-secondary size-12 shrink-0 p-0" aria-label="Join event">
            <JoinIcon size={22} />
          </Link>
        ) : null}
        <Link href="/new" className="btn btn-primary flex-1">
          <Plus size={20} strokeWidth={1.75} /> {events.length ? "New event" : "Create event"}
        </Link>
      </BottomBar>
    </>
  );
}

// Data streams in behind a skeleton so navigation is instant.
export default function Home() {
  return (
    <Suspense fallback={<EventsSkeleton />}>
      <Content />
    </Suspense>
  );
}
