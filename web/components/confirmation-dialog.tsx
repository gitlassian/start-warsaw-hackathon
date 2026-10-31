"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./confirmation-dialog.css";

/** Mounted when requested; native dialog keeps focus above the photo viewer too. */
export function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  pendingLabel,
  icon,
  note,
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  icon: ReactNode;
  note?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const id = useId();

  useEffect(() => {
    const modal = dialog.current!;
    modal.showModal();
    return () => modal.close();
  }, []);

  async function confirm() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError("");
    try {
      await onConfirm();
      dialog.current?.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      aria-busy={pending}
      onClose={(e) => {
        // Ignore a queued close event if Strict Mode has already reopened the dialog.
        if (!e.currentTarget.open) onClose();
      }}
      onCancel={(e) => {
        if (running.current) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || running.current) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
          e.currentTarget.close();
        }
      }}
    >
      <div className={`${destructive ? "confirmation-danger" : "text-accent"} mb-4 flex size-12 items-center justify-center rounded-full bg-surface`} aria-hidden>
        {icon}
      </div>
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div id={`${id}-description`} className="mt-2 text-sm leading-relaxed text-muted" style={{ overflowWrap: "anywhere" }}>
        <p>{children}</p>
        {note ? <p className="mt-2">{note}</p> : null}
      </div>
      {error ? <p role="alert" className="confirmation-danger mt-4 text-sm">{error}</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => dialog.current?.close()}>
          Cancel
        </button>
        <button type="button" className={`${destructive ? "confirmation-destructive" : ""} btn btn-primary`} disabled={pending} onClick={confirm}>
          <span aria-live="polite">{pending ? pendingLabel : confirmLabel}</span>
        </button>
      </div>
    </dialog>
  );
}
