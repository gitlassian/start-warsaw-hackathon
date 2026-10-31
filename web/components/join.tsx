"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomBar } from "@/components/bars";
import { ArrowDown } from "@/components/icons";
import { api } from "@/lib/client";
import { fireConfetti } from "@/lib/confetti";

export function CodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      className="flex flex-1 flex-col px-4 pt-10"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/join/${code}`);
      }}
    >
      <label htmlFor="code" className="text-center text-muted">
        Enter the 6-character code from the host
      </label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="ABC123"
        className="mt-4 h-16 w-full rounded-ui border border-line bg-bg text-center font-mono text-3xl tracking-[0.3em] uppercase focus-visible:border-accent focus-visible:outline-none"
      />
      <p className="mt-4 text-center text-sm text-muted">Or scan the host’s QR code with your camera.</p>
      <BottomBar>
        <button type="submit" disabled={code.length !== 6} className="btn btn-primary w-full">
          Continue
        </button>
      </BottomBar>
    </form>
  );
}

export function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="w-full">
      {error ? (
        <p role="alert" className="mb-2 px-1 text-sm">
          {error}
        </p>
      ) : (
        <p className="mb-3 flex items-center justify-center gap-1.5 text-sm text-muted">
          Tap <span className="font-medium text-fg">Join event</span> to open the album
          <ArrowDown size={16} className="nudge" />
        </p>
      )}
      <button
        disabled={pending}
        className={`btn btn-primary w-full ${pending ? "" : "join-cta"}`}
        onClick={() =>
          startTransition(async () => {
            try {
              await api(`/api/codes/${code}/join`, { body: {} });
              fireConfetti(); // keeps falling over the album, which opens right behind it
              router.replace(`/e/${code.toUpperCase()}`);
            } catch (e) {
              setError((e as Error).message);
            }
          })
        }
      >
        {pending ? "Joining…" : "Join event"}
      </button>
    </div>
  );
}
