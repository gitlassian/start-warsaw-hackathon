"use client";

import { LogOut } from "@/components/icons";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";

export function Account({ user }: { user: User }) {
  async function signOut() {
    await api("/api/auth/logout", { body: {} });
    location.replace("/login");
  }

  return (
    <>
      <button popoverTarget="account" className="btn-icon" aria-label="Account">
        {user.picture ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-surface text-sm font-medium">
            {user.name[0]}
          </span>
        )}
      </button>
      <div
        popover="auto"
        id="account"
        className="fixed inset-auto top-[calc(env(safe-area-inset-top)+3.5rem)] right-3 m-0 w-64 rounded-2xl border border-line bg-bg p-1.5 text-fg shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
      >
        <div className="px-3 py-2">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <button onClick={signOut} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 active:bg-surface">
          <LogOut size={18} strokeWidth={1.75} /> Sign out
        </button>
      </div>
    </>
  );
}
