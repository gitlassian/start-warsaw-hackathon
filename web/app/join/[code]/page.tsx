import { Suspense } from "react";
import { Skeleton } from "@/components/skeleton";
import { redirect } from "next/navigation";
import { BottomBar, TopBar } from "@/components/bars";
import { JoinButton } from "@/components/join";
import { When } from "@/components/when";
import { apiGet } from "@/lib/server";
import type { EventItem } from "@/lib/types";

async function Content({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const event = await apiGet<EventItem & { joined: boolean }>(`/api/codes/${code}`, `/join/${code}`);
  if (event.joined) redirect(`/e/${event.id}`);

  return (
    <>
      <TopBar back="/" title="Join event" />
      <div className="flex flex-1 flex-col justify-center px-4 text-center">
        {event.cover_url ? (
          <img src={event.cover_url} alt="" className="aspect-[3/2] w-full rounded-card border border-line object-cover" />
        ) : null}
        <h1 className="mt-5 text-[26px] leading-tight font-semibold tracking-tight text-balance">{event.title}</h1>
        <p className="mt-1 text-muted">
          <When start={event.starts_at} end={event.ends_at} />
        </p>
        <p className="mt-4 text-muted">You’ll be able to see the album and add your photos.</p>
      </div>
      <BottomBar>
        <JoinButton code={code} />
      </BottomBar>
    </>
  );
}

// Data streams in behind a skeleton so navigation is instant.
export default function JoinPreview(props: PageProps<"/join/[code]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
