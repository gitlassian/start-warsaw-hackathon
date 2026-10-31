"use client";

import { LogOut } from "@/components/icons";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";

export function Account({ user }: { user: User }) {
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function signOut() {
    await api("/api/auth/logout", { body: {} });
    location.replace("/login");
  }

  return (
    <>
      <button ref={trigger} type="button" popoverTarget="account" className="btn-icon" aria-label="Account">
        {user.picture ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-surface text-sm font-medium">
            {user.name[0]}
          </span>
        )}
      </button>
      <div
        ref={menu}
        popover="auto"
        id="account"
        className="fixed inset-auto top-[calc(env(safe-area-inset-top)+3.5rem)] right-3 m-0 w-64 rounded-card border border-line bg-bg p-1.5 text-fg shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
      >
        <div className="px-3 py-2">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            menu.current?.hidePopover();
            setConfirmSignOut(true);
          }}
          className="flex h-11 w-full items-center gap-3 rounded-thumb px-3 active:bg-surface"
        >
          <LogOut size={18} strokeWidth={1.75} /> Sign out
        </button>
      </div>
      {confirmSignOut ? (
        <ConfirmationDialog
          title="Sign out?"
          confirmLabel="Sign out"
          pendingLabel="Signing out…"
          icon={<LogOut size={24} strokeWidth={1.75} />}
          onConfirm={signOut}
          onClose={() => {
            setConfirmSignOut(false);
            trigger.current?.focus();
          }}
        >
          You’ll be signed out of RollCall on this device. Your events, photos and videos will stay safe.
        </ConfirmationDialog>
      ) : null}
    </>
  );
}
