import { Suspense } from "react";
import { Skeleton } from "@/components/skeleton";
import Link from "next/link";
import { ChevronRight, Images, JoinIcon, Plus } from "@/components/icons";
import { Account } from "@/components/account";
import { BottomBar, TopBar } from "@/components/bars";
import { Empty, EmptyRoll } from "@/components/empty";
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
      <TopBar title={<img src="/logo.svg" alt="RollCall" className="-ml-1 h-8 dark:invert" />} right={<Account user={me} />} />
      {events.length ? (
        <ul className="flex flex-col px-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/e/${e.id}`} className="flex items-center gap-3 rounded-card p-2 active:bg-surface">
                {e.preview_url ? (
                  <img src={e.preview_url} alt="" className="size-14 shrink-0 rounded-thumb border border-line object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-thumb bg-surface text-faint">
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
        <Empty art={<EmptyRoll />} title="No events yet">
          Create an event for your party, or join one with the code from the host.
        </Empty>
      )}
      <BottomBar>
        <Link href="/join" className="btn btn-secondary size-12 shrink-0 p-0" aria-label="Join event">
          <JoinIcon size={22} />
        </Link>
        <Link href="/new" className="btn btn-primary flex-1">
          <Plus size={20} strokeWidth={1.75} /> New event
        </Link>
      </BottomBar>
    </>
  );
}

// Data streams in behind a skeleton so navigation is instant.
export default function Home() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content />
    </Suspense>
  );
}
