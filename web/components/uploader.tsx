"use client";

import { Camera as CameraIcon, ImagePlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera } from "@/components/camera";
import { uploadPhoto } from "@/lib/client";

export function Uploader({ eventId, guestInvitation, uploadsOpen = true }: { eventId: number; guestInvitation?: string; uploadsOpen?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const running = useRef(0); // upload() calls in flight: the camera feeds in shot by shot while a gallery batch may run
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<File[]>([]);
  const [camera, setCamera] = useState(false);
  const [added, setAdded] = useState(0);
  const [failureReason, setFailureReason] = useState("");

  async function upload(files: File[]) {
    running.current++;
    setProgress((p) => ({ done: p?.done ?? 0, total: (p?.total ?? 0) + files.length }));
    const bad: File[] = [];
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const file = files[next++];
        await uploadPhoto(eventId, file, guestInvitation).catch((error: Error) => {
          bad.push(file);
          setFailureReason(error.message);
        });
        setProgress((p) => p && { ...p, done: p.done + 1 });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setFailed((f) => [...f, ...bad]);
    setAdded((n) => n + files.length - bad.length);
    if (--running.current === 0) setProgress(null);
    router.refresh();
  }

  function retry() {
    const files = failed;
    setFailed([]);
    upload(files);
  }

  return (
    <div className="w-full">
      {failed.length ? (
        <div role="alert" className="mb-2 flex items-center justify-between gap-3 px-1 text-sm">
          <span>{failed.length === 1 ? "1 file" : `${failed.length} files`} didn&apos;t upload<span className="block text-xs text-muted">{failureReason}</span></span>
          <button onClick={retry} className="h-11 px-2 font-medium underline underline-offset-4">
            Retry
          </button>
        </div>
      ) : null}
      {!progress && added > 0 ? <p role="status" className="mb-2 px-1 text-sm text-muted">Added {added} {added === 1 ? "photo or video" : "photos and videos"}</p> : null}
      {!uploadsOpen ? <p className="py-2 text-center text-sm text-muted">The host has paused photo uploads</p> : <div className="flex items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        aria-label="Choose photos and videos"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) upload(files);
        }}
      />
      <button type="button" onClick={() => setCamera(true)} className="btn btn-secondary size-12 shrink-0 p-0" aria-label="Take a photo">
        <CameraIcon size={22} strokeWidth={1.75} />
      </button>
      <button
        className={`btn btn-primary min-w-0 flex-1${progress ? " shimmer-action" : ""}`}
        aria-busy={!!progress}
        onClick={() => input.current?.click()}
      >
        {progress ? (
          <>
            {/* The button itself fills as files land. */}
            <span
              aria-hidden
              className="absolute inset-0 origin-left bg-bg/20 transition-transform duration-500 ease-(--ease-out-expo)"
              style={{ transform: `scaleX(${progress.done / progress.total})` }}
            />
            <span className="relative tabular-nums" aria-live="polite">
              Uploading {progress.done} of {progress.total}
            </span>
          </>
        ) : (
          <>
            <ImagePlus size={20} strokeWidth={1.75} /> Add photos &amp; videos
          </>
        )}
      </button>
      </div>}

      {camera ? <Camera onShot={(file) => upload([file])} onClose={() => setCamera(false)} /> : null}
    </div>
  );
}
