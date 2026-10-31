"use client";

import { Check, Copy, QrCode, Share, X } from "@/components/icons";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";

export function Invite({ code, title }: { code: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  function open() {
    setLink(`${location.origin}/join/${code}`);
    setCopied(false);
    dialog.current?.showModal();
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title, text: `Add your photos to “${title}” on RollCall`, url: link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    }
  }

  return (
    <>
      <button onClick={open} className="btn-icon" aria-label="Invite people">
        <QrCode size={22} strokeWidth={1.75} />
      </button>
      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby="invite-title"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-line" aria-hidden />
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 id="invite-title" className="text-lg font-semibold">
              Invite people
            </h2>
            <p className="text-muted">Scan with the camera, or enter the code in RollCall.</p>
          </div>
          <button onClick={() => dialog.current?.close()} className="btn-icon shrink-0" aria-label="Close">
            <X size={22} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mx-auto mt-3 w-fit rounded-card border border-line bg-white p-5">
          {link ? <QRCodeSVG value={link} size={208} marginSize={0} title={`Join ${title}`} /> : <div className="size-52" />}
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
          className="mx-auto mt-4 flex h-12 items-center gap-2 rounded-full px-4 font-mono text-2xl tracking-[0.3em] active:bg-surface"
          aria-label={`Copy code ${code}`}
        >
          {code}
          {copied ? <Check size={18} className="text-muted" /> : <Copy size={18} className="text-muted" />}
        </button>

        <button onClick={share} className="btn btn-primary mt-6 w-full">
          <Share size={20} strokeWidth={1.75} /> Share link
        </button>
      </dialog>
    </>
  );
}
