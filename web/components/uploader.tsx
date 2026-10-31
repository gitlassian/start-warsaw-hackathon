"use client";

import { ImagePlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/client";

export function Uploader({ eventId }: { eventId: number }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<File[]>([]);

  async function upload(files: File[]) {
    setFailed([]);
    setProgress({ done: 0, total: files.length });
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
    setProgress(null);
    setFailed(bad);
    router.refresh();
  }

  return (
    <div className="w-full">
      {failed.length ? (
        <div role="alert" className="mb-2 flex items-center justify-between gap-3 px-1 text-sm">
          <span>
            {failed.length === 1 ? "1 photo" : `${failed.length} photos`} didn&apos;t upload.
          </span>
          <button onClick={() => upload(failed)} className="h-11 px-2 font-medium underline underline-offset-4">
            Retry
          </button>
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
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
        onClick={() => !progress && input.current?.click()}
      >
        {progress ? (
          <>
            {/* The button itself fills as photos land. */}
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
            <ImagePlus size={20} strokeWidth={1.75} /> Add photos
          </>
        )}
      </button>
    </div>
  );
}
