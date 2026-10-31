"use client";

import type { ReactNode } from "react";
import { Trash2 } from "@/components/icons";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

export function DeleteDialog(props: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <ConfirmationDialog
      {...props}
      destructive
      icon={<Trash2 size={24} strokeWidth={1.75} />}
      pendingLabel="Deleting…"
      note="This can’t be undone"
    />
  );
}
