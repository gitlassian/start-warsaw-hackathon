"use client";

import { Download, Film, Play, Search, Trash2, X } from "@/components/icons";
import { EmptyAlbum } from "@/components/empty-album";
import { DeleteDialog } from "@/components/delete-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Photo, SearchResult } from "@/lib/types";

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

export function Album({ eventId, photos: all, hidden }: { eventId: number; photos: Photo[]; hidden: number[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<number[] | null>(null); // photo ids, best match first
  const [showAll, setShowAll] = useState(false); // near-duplicates are tucked away unless asked for
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Photo | null>(null);

  // Search results replace the grid (best match first); similar photos stay hidden in either view.
  const hiddenIds = new Set(hidden);
  const byId = new Map(all.map((p) => [p.id, p]));
  const base = hits ? hits.flatMap((id) => byId.get(id) ?? []) : all;
  const photos = showAll ? base : base.filter((p) => !hiddenIds.has(p.id));
  const current = photos[index];

  // Photos that arrive while the album is open fade in; the ones already there at load stay still.
  const [seen] = useState(() => new Set(all.map((p) => p.id)));
  const fresh = new Set(all.filter((p) => !seen.has(p.id)).map((p) => p.id));
  useEffect(() => {
    all.forEach((p) => seen.add(p.id));
  }, [all, seen]);

  // Only the video on screen may play.
  const pauseVideos = () => strip.current?.querySelectorAll("video").forEach((v) => v.pause());
  useEffect(pauseVideos, [index]);

  async function runSearch(q: string, includeSimilar: boolean) {
    if (!q) return setHits(null);
    const { results } = await api<SearchResult>(
      `/api/events/${eventId}/search?q=${encodeURIComponent(q)}${includeSimilar ? "&all=true" : ""}`,
    );
    setHits(results.map((r) => r.id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await runSearch(query.trim(), showAll);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSimilar() {
    setShowAll(!showAll);
    if (hits) await runSearch(query.trim(), !showAll).catch(() => {});
  }

  function closeSearch() {
    setSearching(false);
    setQuery("");
    setHits(null);
  }

  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
    requestAnimationFrame(() => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: "instant" }));
  }

  async function remove(photo: Photo) {
    await api(`/api/photos/${photo.id}`, { method: "DELETE" });
    dialog.current?.close();
    router.refresh();
  }

  if (!all.length) {
    return <EmptyAlbum />;
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 pb-3">
        {searching ? (
          <form onSubmit={submit} role="search" className="relative flex-1">
            <Search size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search photos: dog, laptop, sunset…"
              aria-label="Search photos"
              className="field pr-11 pl-11"
              enterKeyHint="search"
            />
            <button type="button" onClick={closeSearch} className="btn-icon absolute top-1/2 right-0.5 -translate-y-1/2 border-0" aria-label="Close search">
              <X size={20} strokeWidth={1.75} />
            </button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1 text-sm text-muted" aria-live="polite">
              {hidden.length ? (
                <button type="button" onClick={toggleSimilar} className="py-2 text-left tabular-nums underline-offset-4 hover:underline">
                  {showAll ? "Hide similar photos" : `${hidden.length} similar hidden · Show`}
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => setSearching(true)} className="btn-icon shrink-0" aria-label="Search photos">
              <Search size={20} strokeWidth={1.75} />
            </button>
            <a
              href={`/api/events/${eventId}/download${showAll ? "?all=true" : ""}`}
              download
              className="btn btn-secondary h-11 shrink-0 px-4 text-sm"
            >
              <Download size={18} strokeWidth={1.75} /> Save all
            </a>
          </>
        )}
      </div>
      {searching && (busy || hits) ? (
        <p className="px-5 pb-2 text-sm text-muted tabular-nums" aria-live="polite">
          {busy ? "Searching…" : `${photos.length} found`}
        </p>
      ) : null}

      {!photos.length ? <p className="px-4 py-16 text-center text-muted">No matching photos.</p> : null}

      <ul className="grid grid-cols-3 gap-1 px-4">
        {photos.map((p, i) => (
          <li key={p.id} className={fresh.has(p.id) ? "tile-in" : undefined}>
            <button
              onClick={() => open(i)}
              className="relative block aspect-square w-full overflow-hidden rounded-ui bg-surface"
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
              <button onClick={() => save(current)} className="btn btn-primary">
                <Download size={20} strokeWidth={1.75} /> Save
              </button>
            ) : null}
            {current?.can_delete ? (
              <button
                onClick={() => {
                  pauseVideos();
                  setDeleting(current);
                }}
                className="btn border border-white/15 text-white"
                aria-label={current.kind === "video" ? "Delete video" : "Delete photo"}
                aria-haspopup="dialog"
              >
                <Trash2 size={20} strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        </div>
      </dialog>
      {deleting ? (
        <DeleteDialog
          title={deleting.kind === "video" ? "Delete video?" : "Delete photo?"}
          confirmLabel={deleting.kind === "video" ? "Delete video" : "Delete photo"}
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        >
          This {deleting.kind === "video" ? "video" : "photo"} will be permanently deleted from the album for everyone.
        </DeleteDialog>
      ) : null}
    </>
  );
}
