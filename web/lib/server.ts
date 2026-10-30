import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

/** Server-side GET to FastAPI with the visitor's session cookie. `from` is where to return after sign-in. */
export async function apiGet<T>(path: string, from: string): Promise<T> {
  const res = await fetch(API_URL + path, { headers: { cookie: (await cookies()).toString() } });
  if (res.status === 401) redirect(`/login?next=${encodeURIComponent(from)}`);
  if (res.status === 404 || res.status === 422) notFound();
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}
