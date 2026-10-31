"use client";

import { ImagePlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomBar } from "@/components/bars";
import { DateTimeField, nextHour } from "@/components/date-time-field";
import { api, uploadCover } from "@/lib/client";
import type { EventItem } from "@/lib/types";

const HOURS_3 = 3 * 3600000;

export function EventForm() {
  const router = useRouter();
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onStart(value: Date) {
    setStart(value);
    // Keep the end sensible: default to three hours after the start.
    if (!end || end <= value) setEnd(new Date(value.getTime() + HOURS_3));
  }

  function submit(form: FormData) {
    setError("");
    if (!start || !end) return setError("Choose when the event starts and ends.");
    if (end <= start) return setError("The end must be after the start.");
    startTransition(async () => {
      try {
        const cover_key = cover ? await uploadCover(cover) : null;
        const event = await api<EventItem>("/api/events", {
          body: {
            title: form.get("title"),
            description: form.get("description"),
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            cover_key,
          },
        });
        router.replace(`/e/${event.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <form
      // onSubmit, not action: a form action resets the fields, which would wipe them on an error
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      className="flex flex-1 flex-col gap-5 px-4 pt-2"
    >
      <label className="relative flex aspect-[3/2] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-card border border-line bg-surface text-muted">
        {preview ? (
          <img src={preview} alt="Cover preview" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <ImagePlus size={28} strokeWidth={1.5} />
            <span>Add cover photo</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (preview) URL.revokeObjectURL(preview);
            setCover(file);
            setPreview(URL.createObjectURL(file));
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted">Name</span>
        <input name="title" required maxLength={120} placeholder="Anna’s birthday" className="field" autoComplete="off" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted">Description</span>
        <textarea name="description" maxLength={2000} rows={3} placeholder="Where, what to bring, anything guests should know" className="field min-h-24 resize-none" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <DateTimeField label="Starts" value={start} onChange={onStart} suggest={nextHour} />
        <DateTimeField
          label="Ends"
          value={end}
          onChange={setEnd}
          suggest={() => new Date((start ?? nextHour()).getTime() + HOURS_3)}
        />
      </div>

      {error ? (
        <p role="alert" className="px-1 text-sm">
          {error}
        </p>
      ) : null}

      <BottomBar>
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Creating…" : "Create event"}
        </button>
      </BottomBar>
    </form>
  );
}
