"use client";

import { Download, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Photo } from "@/lib/types";

async function save(photo: Photo) {
  // On phones the share sheet's "Save Image" puts it in the camera roll; a download would land in Files.
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare) {
    try {
      const blob = await (await fetch(photo.url)).blob();
      const file = new File([blob], photo.url.split("?")[0].split("/").pop()!, { type: blob.type });
      if (navigator.canShare({ files: [file] })) return await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  location.href = photo.download_url;
}

export function Album({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const current = photos[index];

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

  if (!photos.length) {
    return (
      <p className="px-4 py-16 text-center text-muted">
        No photos yet.
        <br />
        Be the first to add some.
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-0.5">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button onClick={() => open(i)} className="block aspect-square w-full overflow-hidden bg-surface">
              <img
                src={p.thumb_url}
                alt={`Photo by ${p.author}`}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dialog} className="viewer" aria-label="Photo viewer">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button onClick={() => dialog.current?.close()} className="btn-icon active:bg-white/10" aria-label="Close">
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
                <img src={p.url} alt={`Photo by ${p.author}`} loading="lazy" className="max-h-full max-w-full object-contain" />
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {current ? (
              <button onClick={() => save(current)} className="btn bg-white text-black">
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
