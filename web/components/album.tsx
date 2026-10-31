"use client";

import { Check, Download, Images, Search, Trash2, X } from "@/components/icons";
import { AlbumTile } from "@/components/album-tile";
import { PhotoGridSkeleton, Shimmer } from "@/components/skeleton";
import { ShimmerImage } from "@/components/shimmer-image";
import { BottomBar } from "@/components/bars";
import { EmptyAlbum } from "@/components/empty-album";
import { DeleteDialog } from "@/components/delete-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/client";
import { useHydrated } from "@/lib/hydrated";
import type { Photo, SearchResult } from "@/lib/types";
import "./album.css";

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

const subscribeTimeZone = () => () => {};
const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "UTC";

export function Album({ eventId, photos: provided, hidden, upload }: {
  eventId: number; photos: Photo[]; hidden: number[]; upload: ReactNode;
}) {
  const router = useRouter();
  const searchId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchRequest = useRef(0);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<number[] | null>(null); // photo ids, best match first
  const [showAll, setShowAll] = useState(false); // near-duplicates are tucked away unless asked for
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const [author, setAuthor] = useState<{ id: number; name: string } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  const [deletingMany, setDeletingMany] = useState<Photo[] | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const hydrated = useHydrated(); // the viewer's language and time zone differ from the server's: draw their dates only after hydration
  const timeZone = useSyncExternalStore(subscribeTimeZone, viewerTimeZone, serverTimeZone);
  const addedAt = useMemo(() => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium", timeStyle: "short", timeZone,
  }), [timeZone]);
  const all = provided.filter((p) => !removed.has(p.id));
  const authors = new Map(all.map((p) => [p.author_id, p.author]));
  if (author && !authors.has(author.id)) authors.set(author.id, author.name);

  // Search results replace the grid (best match first); similar photos stay hidden in either view.
  const hiddenIds = new Set(hidden);
  const byId = new Map(all.map((p) => [p.id, p]));
  const base = hits ? hits.flatMap((id) => byId.get(id) ?? []) : all;
  const photos = base.filter((p) => (showAll || !hiddenIds.has(p.id))
    && (!author || p.author_id === author.id));
  const current = photos[index];
  const selectedPhotos = photos.filter((p) => selected.has(p.id));
  const allSelected = photos.length > 0 && selectedPhotos.length === photos.length;
  const canDeleteSelection = selectedPhotos.length > 0 && selectedPhotos.every((p) => p.can_delete);
  const filtered = !!(author || hits);

  // Photos that arrive while the album is open fade in; the ones already there at load stay still.
  const [seen] = useState(() => new Set(all.map((p) => p.id)));
  const fresh = new Set(all.filter((p) => !seen.has(p.id)).map((p) => p.id));
  useEffect(() => {
    all.forEach((p) => seen.add(p.id));
  }, [all, seen]);

  // Only the video on screen may play.
  const pauseVideos = () => strip.current?.querySelectorAll("video").forEach((v) => v.pause());
  useEffect(pauseVideos, [index]);

  useEffect(() => {
    if (!selecting) return;
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        setSelecting(false);
        setSelected(new Set());
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [selecting]);

  async function runSearch(q: string, includeSimilar: boolean) {
    const request = ++searchRequest.current;
    setSelected(new Set());
    setError("");
    if (!q) { setHits(null); setBusy(false); return; }
    setBusy(true);
    try {
      const { results } = await api<SearchResult>(
        `/api/events/${eventId}/search?q=${encodeURIComponent(q)}${includeSimilar ? "&all=true" : ""}`,
      );
      if (request === searchRequest.current) setHits(results.map((r) => r.id));
    } catch (err) {
      if (request === searchRequest.current) setError((err as Error).message);
    } finally {
      if (request === searchRequest.current) setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await runSearch(query.trim(), showAll);
  }

  async function toggleSimilar() {
    setShowAll(!showAll);
    setSelected(new Set());
    if (hits || busy) await runSearch(query.trim(), !showAll);
  }

  function clearSearch() {
    setQuery("");
    setHits(null);
    ++searchRequest.current;
    setBusy(false);
    setSelected(new Set());
    searchInput.current?.focus();
  }

  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
    requestAnimationFrame(() => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: "instant" }));
  }

  async function remove(photo: Photo) {
    await api(`/api/photos/${photo.id}`, { method: "DELETE" });
    dialog.current?.close();
    setDeleting(null);
    setRemoved((previous) => new Set([...previous, photo.id]));
    router.refresh();
  }

  function finishSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggleSelected(id: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveMany(items: Photo[]) {
    if (!items.length || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/download`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photo_ids: items.map((p) => p.id) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : "Could not prepare the download. Try again");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "rollcall-photos.zip";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function removeMany(items: Photo[]) {
    const result = await api<{ deleted: number[] }>(`/api/events/${eventId}/photos/delete`, {
      body: { photo_ids: items.map((p) => p.id) },
    });
    setRemoved((previous) => new Set([...previous, ...result.deleted]));
    setDeletingMany(null);
    finishSelection();
    router.refresh();
  }

  const saveAll = all.length ? (
    filtered ? (
      <button type="button" onClick={() => saveMany(photos)} disabled={!photos.length || downloading || busy} className={`btn btn-secondary album-save${downloading ? " shimmer-action" : ""}`} aria-label="Save all matching photos" aria-busy={downloading}>
        <Download size={18} strokeWidth={1.75} /> {downloading ? "Saving…" : "Save all"}
      </button>
    ) : (
      <a href={`/api/events/${eventId}/download${showAll ? "?all=true" : ""}`} download className="btn btn-secondary album-save">
        <Download size={18} strokeWidth={1.75} /> Save all
      </a>
    )
  ) : null;

  const heading = (
    <div className="album-heading">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="font-semibold whitespace-nowrap" aria-live="polite">{selecting ? `${selectedPhotos.length} selected` : "Photos"}</h2>
        {!selecting ? busy ? <Shimmer className="h-4 w-6" /> : <span className="text-sm text-muted tabular-nums" aria-live="polite">{photos.length}</span> : null}
      </div>
      <div className="album-summary">
        {selecting ? (
          <>
            <button type="button" className="btn btn-secondary album-selection-all" disabled={!photos.length || busy} aria-pressed={allSelected} onClick={() => {
              setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id)));
            }}>
              <Check size={18} strokeWidth={1.75} />
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <button type="button" className="btn btn-secondary album-selection-cancel" onClick={finishSelection} aria-label="Cancel" title="Cancel selection">
              <X size={18} strokeWidth={1.75} />
              <span className="album-cancel-label">Cancel</span>
            </button>
          </>
        ) : (
          <>
            {hidden.length ? (
              <button
                type="button"
                onClick={toggleSimilar}
                className="btn btn-secondary album-similar-toggle"
                aria-pressed={showAll}
                aria-label={showAll ? "Hide similar" : "Show similar"}
                title={showAll ? "Hide similar" : "Show similar"}
              >
                <Images size={18} strokeWidth={1.75} />
                <span className="album-similar-label">{showAll ? "Hide similar" : "Show similar"}</span>
              </button>
            ) : null}
            {saveAll}
          </>
        )}
      </div>
    </div>
  );

  const footer = (
    <BottomBar>
      {selecting ? (
        <div className="w-full">
          {!selectedPhotos.length || !canDeleteSelection ? (
            <p className="mb-2 text-center text-sm text-muted">
              {!selectedPhotos.length ? "Tap photos to select them" : "You can only delete your own uploads"}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className={`btn btn-primary flex-1${downloading ? " shimmer-action" : ""}`} disabled={!selectedPhotos.length || downloading} aria-busy={downloading} onClick={() => saveMany(selectedPhotos)} aria-label={`Save ${selectedPhotos.length} selected ${selectedPhotos.length === 1 ? "item" : "items"}`}>
              <Download size={20} /> {downloading ? "Preparing…" : "Save"}
            </button>
            <button type="button" className="btn btn-secondary flex-1" disabled={!canDeleteSelection || downloading} onClick={() => setDeletingMany([...selectedPhotos])} aria-haspopup="dialog">
              <Trash2 size={20} /> Delete
            </button>
          </div>
        </div>
      ) : upload}
    </BottomBar>
  );

  if (!all.length) return <>{heading}<EmptyAlbum />{footer}</>;

  return (
    <>
      {heading}
      <div className="album-filters">
        <form onSubmit={submit} role="search">
          <label htmlFor={searchId}>Search</label>
          <div className="relative">
            <Search size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              id={searchId}
              ref={searchInput}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) {
                  ++searchRequest.current;
                  setHits(null);
                  setBusy(false);
                  setSelected(new Set());
                }
              }}
              placeholder="Guy in a red hoodie with a cake"
              aria-label="Search photos"
              className={`field album-search-input${query ? " has-query" : ""}`}
              enterKeyHint="search"
            />
            {query ? (
              <button type="button" onClick={clearSearch} className="btn-icon absolute top-1/2 right-0.5 -translate-y-1/2 border-0" aria-label="Clear search">
                <X size={20} strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        </form>
        <label>
          <span>Added by</span>
          <select className="field" value={author?.id ?? ""} onChange={(e) => {
            const id = Number(e.target.value);
            setAuthor(e.target.value ? { id, name: authors.get(id)! } : null);
            setSelected(new Set());
          }}>
            <option value="">Everyone</option>
            {[...authors].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>
      {author ? <div className="px-4"><button type="button" className="album-similar text-sm text-muted" onClick={() => {
        setAuthor(null); setSelected(new Set());
      }}>Clear filter</button></div> : null}
      {error ? <p role="alert" className="px-4 pb-3 text-sm text-muted">{error}</p> : null}
      {!busy && hits ? (
        <p className="px-5 pb-2 text-sm text-muted tabular-nums" aria-live="polite">
          {photos.length} found
        </p>
      ) : null}

      {!busy && !photos.length ? <p className="px-4 py-16 text-center text-muted">No matching photos</p> : null}

      {busy ? <PhotoGridSkeleton label="Searching photos" /> : <ul className="album-grid">
        {photos.map((p, i) => (
          <li key={p.id} className={fresh.has(p.id) ? "tile-in" : undefined}>
            <AlbumTile
              photo={p}
              selecting={selecting}
              selected={selected.has(p.id)}
              onOpen={() => open(i)}
              onSelect={() => toggleSelected(p.id)}
              onLongPress={() => { setSelecting(true); setSelected(new Set([p.id])); }}
            />
          </li>
        ))}
      </ul>}

      <dialog ref={dialog} className="viewer" aria-label="Photo viewer" onClose={pauseVideos}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button onClick={() => dialog.current?.close()} className="btn-icon border-white/15 active:bg-white/10" aria-label="Close">
              <X size={24} strokeWidth={1.75} />
            </button>
            <div className="min-w-0 flex-1 text-center text-sm">
              <p className="truncate font-medium">{current?.author}</p>
              {current && hydrated ? <p className="text-white/60">Added {addedAt.format(new Date(current.created_at))}</p> : null}
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
                  <ShimmerImage src={p.url} alt={`Photo by ${p.author}`} loading="lazy" className="shimmer-image-contain size-full" />
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
          This {deleting.kind === "video" ? "video" : "photo"} will be permanently deleted from the album for everyone
        </DeleteDialog>
      ) : null}
      {deletingMany ? (
        <DeleteDialog
          title={`Delete ${deletingMany.length === 1 ? "this item" : `${deletingMany.length} items`}?`}
          confirmLabel={`Delete ${deletingMany.length === 1 ? "item" : `${deletingMany.length} items`}`}
          onConfirm={() => removeMany(deletingMany)}
          onClose={() => setDeletingMany(null)}
        >
          {deletingMany.length === 1 ? "This selected item will" : `These ${deletingMany.length} selected items will`} be permanently deleted from the album for everyone
        </DeleteDialog>
      ) : null}
      {footer}
    </>
  );
}
