"use client";

import { Check, Copy, QrCode, Share, X } from "@/components/icons";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { EventItem } from "@/lib/types";

export function Invite({ event }: { event: EventItem }) {
  const { code, title } = event;
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [access, setAccess] = useState(event);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  function open() {
    setAccess(event);
    setLink(`${location.origin}/join/${event.invite_token ?? code}`);
    setCopied(false);
    setError("");
    dialog.current?.showModal();
  }

  async function changeAccess(body: { invites_open?: boolean; uploads_open?: boolean; rotate_invite?: boolean }) {
    setBusy(true);
    setError("");
    try {
      const updated = await api<EventItem>(`/api/events/${event.id}/access`, { method: "PATCH", body });
      setAccess(updated);
      setLink(`${location.origin}/join/${updated.invite_token ?? code}`);
      setCopied(false);
      router.refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
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
        <div className="mx-auto mb-2 h-1 w-9 rounded-ui bg-line" aria-hidden />
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 id="invite-title" className="text-lg font-semibold">
              Invite people
            </h2>
            <p className="text-muted">Scan to open the album</p>
          </div>
          <button onClick={() => dialog.current?.close()} className="btn-icon shrink-0" aria-label="Close">
            <X size={22} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mx-auto mt-3 w-fit rounded-ui border border-line bg-white p-5">
          {link && access.invites_open ? <QRCodeSVG value={link} size={208} marginSize={0} title={`Join ${title}`} /> : <div className="flex size-52 items-center justify-center text-center text-sm text-black">Invitations are paused</div>}
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
          className="mx-auto mt-4 flex h-12 items-center gap-2 rounded-ui px-4 font-mono text-2xl tracking-[0.3em] active:bg-surface"
          aria-label={`Copy code ${code}`}
          disabled={!access.invites_open}
        >
          {code}
          {copied ? <Check size={18} className="text-muted" /> : <Copy size={18} className="text-muted" />}
        </button>

        <p className="mt-2 text-center text-xs text-muted">Anyone with the link or code can join</p>
        {event.is_owner ? (
          <div className="mt-4 border-t border-line pt-3">
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              Allow new guests
              <input type="checkbox" checked={access.invites_open} disabled={busy} onChange={(e) => changeAccess({ invites_open: e.target.checked })} className="size-5 accent-accent" />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              Allow photo uploads
              <input type="checkbox" checked={access.uploads_open} disabled={busy} onChange={(e) => changeAccess({ uploads_open: e.target.checked })} className="size-5 accent-accent" />
            </label>
            <button type="button" disabled={busy} onClick={() => changeAccess({ rotate_invite: true })} className="min-h-11 text-sm underline underline-offset-4">Replace invitation link</button>
            <p className="text-xs text-muted">Replacing the link disables old links and QR codes, but keeps the short code and existing members</p>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-3 text-sm">{error}</p> : null}
        <button onClick={share} disabled={busy || !access.invites_open} className="btn btn-primary mt-6 w-full">
          <Share size={20} strokeWidth={1.75} /> Share link
        </button>
      </dialog>
    </>
  );
}
