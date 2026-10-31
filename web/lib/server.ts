import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { EventItem } from "@/lib/types";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

/** Server-side GET to FastAPI with the visitor's session cookie. `from` is where to return after sign-in. */
export async function apiGet<T>(path: string, from: string): Promise<T> {
  const res = await fetch(API_URL + path, { headers: { cookie: (await cookies()).toString() } }).catch(() => {
    throw new Error(`Can't reach the API at ${API_URL}. Is it running?`);
  });
  if (res.status === 401) redirect(`/login?next=${encodeURIComponent(from)}`);
  if (res.status === 404 || res.status === 422) notFound();
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}

/**
 * Finds the event behind the code in the URL, the same code the QR carries. Someone who hasn't joined is sent to
 * the join screen, a lowercase code is normalised, and old numeric links (/e/1) are forwarded to their code.
 * `suffix` is the rest of the path, e.g. "/edit".
 */
export async function eventByCode(code: string, suffix = ""): Promise<EventItem> {
  const from = `/e/${code}${suffix}`;
  if (/^\d{1,5}$/.test(code)) {
    const old = await apiGet<EventItem>(`/api/events/${code}`, from);
    redirect(`/e/${old.code}${suffix}`);
  }
  const event = await apiGet<EventItem & { joined: boolean }>(`/api/codes/${code}`, from);
  if (!event.joined) redirect(`/join/${event.code}`);
  if (code !== event.code) redirect(`/e/${event.code}${suffix}`);
  return event;
}

/** Server-side GET to a public endpoint; null on any failure so the page can fall back. */
export async function apiPublic<T>(path: string): Promise<T | null> {
  return fetch(API_URL + path)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
}
