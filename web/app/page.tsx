import { Suspense } from "react";
import { Skeleton } from "@/components/skeleton";
import Link from "next/link";
import { ChevronRight, Images, Plus } from "lucide-react";
import { Account } from "@/components/account";
import { BottomBar, TopBar } from "@/components/bars";
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
      <TopBar title={<img src="/logo.svg" alt="RollCall" className="h-8 dark:invert" />} right={<Account user={me} />} />
      {events.length ? (
        <ul className="flex flex-col px-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/e/${e.id}`} className="flex items-center gap-3 rounded-2xl p-2 active:bg-surface">
                {e.cover_url ? (
                  <img src={e.cover_url} alt="" className="size-14 shrink-0 rounded-xl border border-line object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-surface text-faint">
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
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-lg font-medium">No events yet</p>
          <p className="mt-1 text-muted">Create one, or join with a code from the host.</p>
        </div>
      )}
      <BottomBar>
        <Link href="/join" className="btn btn-secondary flex-1">
          Join
        </Link>
        <Link href="/new" className="btn btn-primary flex-[2]">
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
