"use client";

import { Download, Film, Play, Search, Trash2, X } from "@/components/icons";
import { Empty, EmptyGrid } from "@/components/empty";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { DuplicatesResult, Photo, SearchResult } from "@/lib/types";

async function save(photo: Photo) {
  // On phones the share sheet's "Save Image" puts it in the camera roll; a download would land in Files.
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare) {
    try {
      const blob = await (await fetch(photo.download_url)).blob(); // the original, not the viewer copy
      const file = new File([blob], photo.url.split("?")[0].split("/").pop()!, { type: blob.type });
      if (navigator.canShare({ files: [file] })) return await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  location.href = photo.download_url;
}

export function Album({ eventId, photos: all }: { eventId: number; photos: Photo[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<number[] | null>(null); // photo ids, best match first
  const [dropped, setDropped] = useState<Set<number> | null>(null); // duplicates hidden; null = showing all
  const [busy, setBusy] = useState(false);

  // Search results replace the grid (best match first); hidden duplicates are removed from either view.
  const byId = new Map(all.map((p) => [p.id, p]));
  const base = hits ? hits.flatMap((id) => byId.get(id) ?? []) : all;
  const photos = dropped ? base.filter((p) => !dropped.has(p.id)) : base;
  const current = photos[index];

  // Only the video on screen may play.
  const pauseVideos = () => strip.current?.querySelectorAll("video").forEach((v) => v.pause());
  useEffect(pauseVideos, [index]);

  async function runSearch(q: string, hideDuplicates: boolean) {
    if (!q) return setHits(null);
    const { results } = await api<SearchResult>(
      `/api/events/${eventId}/search?q=${encodeURIComponent(q)}${hideDuplicates ? "" : "&all=true"}`,
    );
    setHits(results.map((r) => r.id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setBusy(true);
    try {
      await runSearch(q, dropped !== null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDuplicates() {
    if (dropped) {
      setDropped(null);
      if (hits) await runSearch(query.trim(), false).catch(() => {});
      return;
    }
    setBusy(true);
    try {
      const { groups } = await api<DuplicatesResult>(`/api/events/${eventId}/duplicates`);
      setDropped(new Set(groups.flatMap((g) => g.drop)));
      if (hits) await runSearch(query.trim(), true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setHits(null);
  }

  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
    requestAnimationFrame(() => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: "instant" }));
  }

  async function remove(photo: Photo) {
    if (!confirm("Delete this photo for everyone?")) return;
    try {
      await api(`/api/photos/${photo.id}`, { method: "DELETE" });
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (!all.length) {
    return (
      <Empty art={<EmptyGrid />} title="No photos yet">
        Tap Add photos to start the roll. Everyone you invite can add theirs too.
      </Empty>
    );
  }

  return (
    <>
      <div className="px-4 pb-3">
        <form onSubmit={submit} role="search" className="relative">
          <Search size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search photos: dog, laptop, sunset…"
            aria-label="Search photos"
            className="field pr-11 pl-11"
            enterKeyHint="search"
          />
          {query ? (
            <button type="button" onClick={clearSearch} className="btn-icon absolute top-1/2 right-0.5 -translate-y-1/2 border-0" aria-label="Clear search">
              <X size={20} strokeWidth={1.75} />
            </button>
          ) : null}
        </form>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={toggleDuplicates}
            disabled={busy}
            aria-pressed={dropped !== null}
            className={`rounded-full border px-3 py-1.5 font-medium transition-colors disabled:opacity-40 ${
              dropped ? "border-accent bg-accent text-on-accent" : "border-line text-fg"
            }`}
          >
            Hide duplicates
          </button>
          <span className="text-muted tabular-nums" aria-live="polite">
            {busy ? "Working…" : dropped ? `${dropped.size} hidden` : hits ? `${photos.length} found` : ""}
          </span>
        </div>
      </div>

      {!photos.length ? <p className="px-4 py-16 text-center text-muted">No matching photos.</p> : null}

      <ul className="grid grid-cols-3 gap-1 px-4">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              onClick={() => open(i)}
              className="relative block aspect-square w-full overflow-hidden rounded-thumb bg-surface"
              aria-label={`${p.kind === "video" ? "Video" : "Photo"} by ${p.author}`}
            >
              {p.thumb_url ? (
                <img src={p.thumb_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              ) : (
                <Film size={24} strokeWidth={1.5} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-faint" />
              )}
              {p.kind === "video" ? (
                <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
                  <Play size={12} />
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dialog} className="viewer" aria-label="Photo viewer" onClose={pauseVideos}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button onClick={() => dialog.current?.close()} className="btn-icon border-white/15 active:bg-white/10" aria-label="Close">
              <X size={24} strokeWidth={1.75} />
            </button>
            <div className="min-w-0 flex-1 text-center text-sm">
              <p className="truncate font-medium">{current?.author}</p>
              <p className="text-white/60 tabular-nums">
                {index + 1} of {photos.length}
              </p>
            </div>
            <span className="w-11" />
          </div>

          <div
            ref={strip}
            onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain [scrollbar-width:none]"
          >
            {photos.map((p) => (
              <div key={p.id} className="flex w-full shrink-0 snap-center items-center justify-center">
                {p.kind === "video" ? (
                  <video
                    src={p.url}
                    poster={p.thumb_url ?? undefined}
                    controls
                    playsInline
                    preload="none"
                    aria-label={`Video by ${p.author}`}
                    className="max-h-full w-full object-contain"
                  />
                ) : (
                  <img src={p.url} alt={`Photo by ${p.author}`} loading="lazy" className="max-h-full max-w-full object-contain" />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {current ? (
              <button onClick={() => save(current)} className="btn bg-accent text-on-accent">
                <Download size={20} strokeWidth={1.75} /> Save
              </button>
            ) : null}
            {current?.can_delete ? (
              <button onClick={() => remove(current)} className="btn border border-white/15 text-white" aria-label="Delete photo">
                <Trash2 size={20} strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
