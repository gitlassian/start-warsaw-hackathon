"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { api } from "@/lib/client";

type GoogleId = {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleButton() {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  async function onCredential({ credential }: { credential: string }) {
    try {
      await api("/api/auth/google", { body: { credential } });
      const next = new URLSearchParams(location.search).get("next") ?? "";
      location.replace(/^\/(?![/\\])/.test(next) ? next : "/"); // only same-site paths: no open redirect
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function render() {
    const id = window.google?.accounts.id;
    if (!id || !box.current || !CLIENT_ID) return;
    id.initialize({ client_id: CLIENT_ID, callback: onCredential });
    id.renderButton(box.current, {
      theme: matchMedia("(prefers-color-scheme: dark)").matches ? "filled_black" : "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: Math.min(box.current.offsetWidth, 400),
    });
  }

  if (!CLIENT_ID) {
    return <p className="text-center text-sm text-muted">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable sign-in.</p>;
  }
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />
      <div ref={box} className="flex h-11 w-full justify-center" />
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
