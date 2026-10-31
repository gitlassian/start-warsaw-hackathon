"use client";

import { Camera as CameraIcon, ImagePlus, Images } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera } from "@/components/camera";
import { uploadPhoto } from "@/lib/client";

const tile =
  "flex h-28 flex-col items-center justify-center gap-2 rounded-ui bg-surface font-medium transition-transform active:scale-[0.97]";

export function Uploader({ eventId }: { eventId: number }) {
  const input = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const running = useRef(0); // upload() calls in flight: the camera feeds in shot by shot while a gallery batch may run
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<File[]>([]);
  const [camera, setCamera] = useState(false);

  async function upload(files: File[]) {
    running.current++;
    setProgress((p) => ({ done: p?.done ?? 0, total: (p?.total ?? 0) + files.length }));
    const bad: File[] = [];
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const file = files[next++];
        await uploadPhoto(eventId, file).catch(() => bad.push(file));
        setProgress((p) => p && { ...p, done: p.done + 1 });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setFailed((f) => [...f, ...bad]);
    if (--running.current === 0) setProgress(null);
    router.refresh();
  }

  function retry() {
    const files = failed;
    setFailed([]);
    upload(files);
  }

  function pickFromGallery() {
    sheet.current?.close();
    input.current?.click();
  }

  function openCamera() {
    sheet.current?.close();
    setCamera(true);
  }

  return (
    <div className="w-full">
      {failed.length ? (
        <div role="alert" className="mb-2 flex items-center justify-between gap-3 px-1 text-sm">
          <span>{failed.length === 1 ? "1 file" : `${failed.length} files`} didn&apos;t upload.</span>
          <button onClick={retry} className="h-11 px-2 font-medium underline underline-offset-4">
            Retry
          </button>
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) upload(files);
        }}
      />
      <button
        className="btn btn-primary w-full"
        aria-busy={!!progress}
        aria-haspopup="dialog"
        onClick={() => sheet.current?.showModal()}
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

      <dialog
        ref={sheet}
        className="sheet"
        aria-label="Add to album"
        onClick={(e) => e.target === e.currentTarget && sheet.current?.close()}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-ui bg-line" aria-hidden />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={pickFromGallery} className={tile}>
            <Images size={26} strokeWidth={1.5} /> Gallery
          </button>
          <button onClick={openCamera} className={tile}>
            <CameraIcon size={26} strokeWidth={1.5} /> Camera
          </button>
        </div>
        <p className="mt-3 text-center text-sm text-muted">Photos and videos, videos up to 200 MB.</p>
      </dialog>

      {camera ? <Camera onShot={(file) => upload([file])} onClose={() => setCamera(false)} /> : null}
    </div>
  );
}
