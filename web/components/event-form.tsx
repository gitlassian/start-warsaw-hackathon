"use client";

import { ImagePlus, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomBar } from "@/components/bars";
import { DateTimeField, nextHour } from "@/components/date-time-field";
import { api, uploadCover } from "@/lib/client";
import type { EventItem } from "@/lib/types";

const HOURS_3 = 3 * 3600000;

/** Creates an event, or edits `event` when given (host only). */
export function EventForm({ event }: { event?: EventItem }) {
  const router = useRouter();
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState(event?.cover_url ?? "");
  const [removeCover, setRemoveCover] = useState(false);
  const [start, setStart] = useState<Date | null>(event ? new Date(event.starts_at) : null);
  const [end, setEnd] = useState<Date | null>(event ? new Date(event.ends_at) : null);
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
        const body = {
          title: form.get("title"),
          description: form.get("description"),
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          cover_key,
        };
        const saved = event
          ? await api<EventItem>(`/api/events/${event.id}`, { method: "PUT", body: { ...body, remove_cover: removeCover } })
          : await api<EventItem>("/api/events", { body });
        router.replace(`/e/${saved.code}`);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function remove() {
    if (!event || !confirm(`Delete “${event.title}” and all its photos for everyone? This can’t be undone.`)) return;
    setError("");
    startTransition(async () => {
      try {
        await api(`/api/events/${event.id}`, { method: "DELETE" });
        router.replace("/");
        router.refresh();
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
      <div className="relative">
        <label className="relative flex aspect-[3/2] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-ui border border-line bg-surface text-muted">
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
              if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
              setCover(file);
              setPreview(URL.createObjectURL(file));
              setRemoveCover(false);
            }}
          />
        </label>
        {preview ? (
          <button
            type="button"
            aria-label="Remove cover photo"
            className="btn-icon absolute top-3 right-3 border-white/30 bg-black/45 text-white backdrop-blur"
            onClick={() => {
              if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
              setCover(null);
              setPreview("");
              setRemoveCover(Boolean(event?.cover_url));
            }}
          >
            <X size={20} />
          </button>
        ) : null}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted">Name</span>
        <input name="title" defaultValue={event?.title} required maxLength={120} placeholder="Anna’s birthday" className="field" autoComplete="off" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted">Description</span>
        <textarea name="description" defaultValue={event?.description} maxLength={2000} rows={3} placeholder="Where, what to bring, anything guests should know" className="field min-h-24 resize-none" />
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

      {event ? (
        <button type="button" onClick={remove} disabled={pending} className="btn btn-secondary text-[#e5484d]">
          Delete event
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="px-1 text-sm">
          {error}
        </p>
      ) : null}

      <BottomBar>
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? (event ? "Saving…" : "Creating…") : event ? "Save changes" : "Create event"}
        </button>
      </BottomBar>
    </form>
  );
}
