"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { api } from "@/lib/client";

type TokenClient = { requestAccessToken(): void };
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(o: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string }) => void;
            error_callback: () => void;
          }): TokenClient;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Google's "G" mark, kept as Google draws it.
const G = (
  <span className="flex size-6 items-center justify-center rounded-full bg-white">
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  </span>
);

/** Our own pill instead of Google's iframe button; Google's popup issues an access token the API verifies. */
export function GoogleButton() {
  const client = useRef<TokenClient | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "busy" | "error">("loading");
  const [error, setError] = useState("");

  async function onToken({ access_token }: { access_token?: string }) {
    if (!access_token) return setState("ready");
    try {
      await api("/api/auth/google", { body: { access_token } });
      const next = new URLSearchParams(location.search).get("next") ?? "";
      location.replace(/^\/(?![/\\])/.test(next) ? next : "/"); // only same-site paths: no open redirect
    } catch (e) {
      setError((e as Error).message);
      setState("ready");
    }
  }

  function init() {
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2 || !CLIENT_ID) return;
    client.current = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "openid email profile",
      callback: onToken,
      error_callback: () => setState("ready"), // popup closed or blocked
    });
    setState("ready");
  }

  if (!CLIENT_ID) {
    return <p className="text-center text-sm text-muted">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable sign-in</p>;
  }
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={init} onError={() => { setState("error"); setError("Couldn’t load Google sign-in. Reload the page to try again"); }} />
      <button
        type="button"
        disabled={state !== "ready"}
        onClick={() => {
          setError("");
          setState("busy");
          client.current?.requestAccessToken(); // must run inside the tap so the popup isn't blocked
        }}
        aria-busy={state === "loading" || state === "busy"}
        className={`btn btn-primary w-full${state === "loading" || state === "busy" ? " shimmer-action" : ""}`}
      >
        {G}
        {state === "busy" ? "Signing in…" : state === "loading" ? "Loading sign-in…" : state === "error" ? "Sign-in unavailable" : "Continue with Google"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
