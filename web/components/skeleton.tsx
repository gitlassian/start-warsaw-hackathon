import type { ReactNode } from "react";
import { BottomBar, TopBar } from "@/components/bars";
import "./album.css";

// Keep the previous public export working for older imports and cached dev modules.
// Current screens use the matching, named skeleton below.
export { EventsSkeleton as Skeleton };

/** Decorative shapes stay out of the accessibility tree; the region announces once. */
export function Shimmer({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`shimmer block rounded-ui ${className}`} />;
}

function LoadingRegion({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-1 flex-col ${className}`} role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function ActionSkeleton({ secondary = false }: { secondary?: boolean }) {
  return (
    <BottomBar>
      {secondary ? <Shimmer className="size-12 shrink-0" /> : null}
      <Shimmer className="h-12 flex-1" />
    </BottomBar>
  );
}

export function EventsSkeleton() {
  return (
    <LoadingRegion label="Loading events">
      <TopBar divider title={<img src="/logo.svg" alt="RollCall" className="-ml-1 h-8 dark:invert" />} right={<Shimmer className="size-11" />} />
      <div className="flex flex-col px-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Shimmer className="size-14 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Shimmer className={`h-5 ${i % 2 ? "w-2/3" : "w-4/5"}`} />
              <Shimmer className="h-4 w-1/2" />
            </div>
            <Shimmer className="size-5 shrink-0" />
          </div>
        ))}
      </div>
      <ActionSkeleton secondary />
    </LoadingRegion>
  );
}

export function PhotoGridSkeleton({ count = 9, label = "Loading photos" }: { count?: number; label?: string }) {
  return (
    <div className="album-grid" role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => <Shimmer key={i} className="aspect-square w-full" />)}
    </div>
  );
}

export function AlbumSkeleton({ label = "Loading album" }: { label?: string }) {
  return (
    <LoadingRegion label={label}>
      <TopBar back="/" right={<div className="flex gap-2"><Shimmer className="size-11" /><Shimmer className="size-11" /></div>} />
      <div className="px-4 pt-5" aria-hidden="true">
        <div className="flex items-center gap-4">
          <Shimmer className="size-20 shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <Shimmer className="h-8 w-4/5" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-2/3" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-3/5" />
        </div>
      </div>
      <div className="album-heading" aria-hidden="true">
        <Shimmer className="h-5 w-20" />
        <Shimmer className="h-11 w-28" />
      </div>
      <div className="album-filters" aria-hidden="true">
        {[0, 1].map((i) => <div key={i} className="space-y-1.5"><Shimmer className="h-4 w-14" /><Shimmer className="h-11 w-full" /></div>)}
      </div>
      <div aria-hidden="true"><PhotoGridSkeleton /></div>
      <ActionSkeleton secondary />
    </LoadingRegion>
  );
}

export function EventFormSkeleton({ editing = false }: { editing?: boolean }) {
  return (
    <LoadingRegion label={editing ? "Loading event details" : "Loading new event"}>
      <TopBar back="/" title={editing ? "Edit event" : "New event"} />
      <div className="flex flex-1 flex-col gap-5 px-4 pt-2" aria-hidden="true">
        <Shimmer className="aspect-[3/2] w-full" />
        <div className="space-y-1.5"><Shimmer className="h-5 w-12" /><Shimmer className="h-[50px] w-full" /></div>
        <div className="space-y-1.5"><Shimmer className="h-5 w-24" /><Shimmer className="h-24 w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => <div key={i} className="space-y-1.5"><Shimmer className="h-5 w-12" /><Shimmer className="h-12 w-full" /></div>)}
        </div>
        {editing ? <Shimmer className="h-12 w-full" /> : null}
      </div>
      <ActionSkeleton />
    </LoadingRegion>
  );
}

/** Fits inside the login shell, which already renders the wordmark and background. */
export function LoginSkeleton() {
  return (
    <LoadingRegion label="Loading sign-in" className="shimmer-on-surface">
      <div className="flex min-h-[min(44svh,28rem)] flex-[1_0_auto] items-center justify-center" aria-hidden="true">
        <Shimmer className="aspect-[4/5] w-[min(52%,15rem,24svh)] rotate-[-6deg]" />
      </div>
      <div className="space-y-3 pt-4" aria-hidden="true">
        <Shimmer className="h-10 w-full" /><Shimmer className="h-10 w-3/4" />
        <div className="space-y-2 pt-1"><Shimmer className="h-4 w-full" /><Shimmer className="h-4 w-full" /><Shimmer className="h-4 w-2/3" /></div>
      </div>
      <Shimmer className="mt-6 h-12 w-full shrink-0" />
    </LoadingRegion>
  );
}
