"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomBar } from "@/components/bars";

export function CodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-1 flex-col px-4 pt-10"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => router.push(`/join/${code}`));
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
      <p className="mt-4 text-center text-sm text-muted">Or scan the host’s QR code with your camera</p>
      <BottomBar>
        <button type="submit" disabled={pending || code.length !== 6} aria-busy={pending} className={`btn btn-primary w-full${pending ? " shimmer-action" : ""}`}>
          {pending ? "Opening album…" : "Continue"}
        </button>
      </BottomBar>
    </form>
  );
}
