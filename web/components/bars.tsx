import Link from "next/link";
import { ChevronLeft } from "@/components/icons";

export function TopBar({ back, title, right }: { back?: string; title?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-2 px-4">
        {back ? (
          <Link href={back} className="btn-icon" aria-label="Back">
            <ChevronLeft size={24} strokeWidth={1.75} />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</div>
        {right}
      </div>
    </header>
  );
}

/** Primary actions live in the thumb zone, above the home indicator. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="h-28 shrink-0" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-lg border-t border-line bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">{children}</div>
      </div>
    </>
  );
}
