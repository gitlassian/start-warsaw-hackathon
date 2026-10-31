"use client";

import { ChevronLeft, SwitchCamera } from "@/components/icons";
import { useEffect, useRef, useState } from "react";

type Facing = "environment" | "user";

/** Full-screen camera. Every shot is handed to `onShot` right away, so the host can upload while you keep shooting. */
export function Camera({ onShot, onClose }: { onShot: (file: File) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [error, setError] = useState("");
  const [shots, setShots] = useState(0);
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => dialog.current?.showModal(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("The camera needs a secure (HTTPS) connection");
        return;
      }
      try {
        stream.current?.getTracks().forEach((t) => t.stop());
        const next = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) return next.getTracks().forEach((t) => t.stop());
        stream.current = next;
        if (video.current) {
          video.current.srcObject = next;
          await video.current.play().catch(() => {});
        }
        setCanFlip((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput").length > 1);
        setError("");
      } catch (e) {
        if (cancelled) return;
        setError(
          (e as DOMException).name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in your browser settings, or add photos from the gallery"
            : "Couldn’t start the camera",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  async function shoot() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.92));
    if (!blob) return;
    onShot(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    setShots((n) => n + 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  }

  return (
    <dialog ref={dialog} className="viewer" aria-label="Camera" onClose={onClose}>
      <div className="relative size-full overflow-hidden">
        <video
          ref={video}
          playsInline
          muted
          onPlaying={() => setReady(true)}
          className="absolute inset-0 size-full object-cover"
          style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
        />
        {!ready && !error ? (
          <div className="shimmer absolute inset-0" role="status" aria-label="Starting camera" aria-busy="true">
            <span className="sr-only">Starting camera</span>
          </div>
        ) : null}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flash ? "opacity-70" : "opacity-0"}`}
        />

        {error ? (
          <p role="alert" className="absolute inset-x-0 top-1/3 px-8 text-center text-white/80">
            {error}
          </p>
        ) : null}

        {shots ? (
          <p
            className="absolute top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 rounded-ui bg-black/50 px-3 py-1.5 text-sm tabular-nums"
            aria-live="polite"
          >
            {shots} added
          </p>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button onClick={() => dialog.current?.close()} className="btn-icon size-12 bg-black/50 active:bg-white/20" aria-label="Back">
            <ChevronLeft size={24} strokeWidth={1.75} />
          </button>
          <button
            onClick={shoot}
            disabled={!ready || !!error}
            aria-label="Take photo"
            className="flex size-[4.5rem] items-center justify-center rounded-full border-4 border-white p-1 transition-transform active:scale-95 disabled:opacity-40"
          >
            <span className="size-full rounded-full bg-white" />
          </button>
          {canFlip ? (
            <button
              onClick={() => { setReady(false); setFacing((f) => (f === "environment" ? "user" : "environment")); }}
              className="btn-icon size-12 bg-black/50 active:bg-white/20"
              aria-label="Switch camera"
            >
              <SwitchCamera size={22} strokeWidth={1.75} />
            </button>
          ) : (
            <span className="size-12" aria-hidden />
          )}
        </div>
      </div>
    </dialog>
  );
}
