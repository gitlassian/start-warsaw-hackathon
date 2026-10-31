"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openInvitation } from "@/lib/client";
import { fireConfetti } from "@/lib/confetti";
import { AlbumSkeleton } from "@/components/skeleton";

/** The invitation grants access. No sign-in or confirmation screen for guests. */
export function GuestJoin({ invitation }: { invitation: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    openInvitation(invitation).then(
      ({ code, joined }) => {
        if (!active) return;
        if (joined) fireConfetti(); // a new member only; the burst keeps falling over the album that opens behind it
        router.replace(`/e/${code}`);
      },
      (reason: Error) => { if (active) setError(reason.message); },
    );
    return () => { active = false; };
  }, [invitation, attempt, router]);

  if (!error) return <AlbumSkeleton label="Opening album" />;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-[26px] font-semibold tracking-tight">Couldn’t open this album</h1>
      <p role="alert" className="text-muted">{error}</p>
      <button className="btn btn-primary" onClick={() => { setError(""); setAttempt(attempt + 1); }}>Try again</button>
      <Link href="/join" className="btn btn-secondary">Enter another code</Link>
    </div>
  );
}
