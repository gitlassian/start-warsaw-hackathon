"use client";

import { ImagePlus, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { BottomBar } from "@/components/bars";
import { ShimmerImage } from "@/components/shimmer-image";
import { DeleteDialog } from "@/components/delete-dialog";
import { DateTimeField, nextHour } from "@/components/date-time-field";
import { api, uploadCover } from "@/lib/client";
import type { EventItem } from "@/lib/types";
import "./cover-picker.css";

const HOURS_3 = 3 * 3600000;
const NAME_LIMIT = 60;
const DESCRIPTION_LIMIT = 500;

/** Creates an event, or edits `event` when given (host only). */
export function EventForm({ event }: { event?: EventItem }) {
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState(event?.cover_url ?? "");
  const [removeCover, setRemoveCover] = useState(false);
  const [start, setStart] = useState<Date | null>(event ? new Date(event.starts_at) : null);
  const [end, setEnd] = useState<Date | null>(event ? new Date(event.ends_at) : null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  function onStart(value: Date) {
    setStart(value);
    // Keep the end sensible: default to three hours after the start.
    if (!end || end <= value) setEnd(new Date(value.getTime() + HOURS_3));
  }

  const nameTooLong = title.length > NAME_LIMIT;
  const descriptionTooLong = description.length > DESCRIPTION_LIMIT;

  function submit() {
    setError("");
    if (!title.trim()) return setError("Enter an event name");
    if (nameTooLong) return setError(`Keep the name within ${NAME_LIMIT} characters`);
    if (descriptionTooLong) return setError(`Keep the description within ${DESCRIPTION_LIMIT} characters`);
    if (!start || !end) return setError("Choose when the event starts and ends");
    if (end <= start) return setError("The end must be after the start");
    startTransition(async () => {
      try {
        const cover_key = cover ? await uploadCover(cover) : null;
        const body = {
          title: title.trim(),
          description: description.trim(),
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

  async function remove() {
    if (!event) return;
    await api(`/api/events/${event.id}`, { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <form
      // onSubmit, not action: a form action resets the fields, which would wipe them on an error
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-1 flex-col gap-5 px-4 pt-2"
    >
      <div className="relative">
        <label className={`cover-picker${preview ? " cover-picker-filled" : ""}`}>
          {preview ? (
            <ShimmerImage src={preview} alt="Cover preview" className="absolute inset-0 size-full" />
          ) : (
            <span className="cover-picker-content">
              <span className="cover-picker-art" aria-hidden>
                <span className="cover-picker-poster">
                  <img src="/invitations/party-time.webp" alt="" draggable={false} />
                </span>
                <span className="cover-picker-invitation">
                  <img src="/invitations/birthday-balloons.webp" alt="" draggable={false} />
                </span>
                <span className="cover-picker-mini-poster">
                  <img src="/invitations/love-party.webp" alt="" draggable={false} />
                </span>
              </span>
              <span className="cover-picker-copy">
                <span className="cover-picker-title">Add cover photo</span>
                <span className="cover-picker-description">Pick a photo that sets the mood</span>
              </span>
              <span className="cover-picker-action"><ImagePlus size={16} /> Choose photo</span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            aria-label={preview ? "Change cover photo" : "Add cover photo"}
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

      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3 px-1 text-sm text-muted">
          <label htmlFor={`${id}-name`}>Name</label>
          <span id={`${id}-name-count`} className={`tabular-nums${nameTooLong ? " text-[#e5484d]" : ""}`} aria-hidden>{title.length} / {NAME_LIMIT}</span>
        </span>
        <input
          id={`${id}-name`}
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={NAME_LIMIT}
          aria-describedby={`${id}-name-count${nameTooLong ? ` ${id}-name-limit` : ""}`}
          aria-invalid={nameTooLong || undefined}
          placeholder="Anna’s birthday"
          className="field"
          autoComplete="off"
        />
        {nameTooLong ? <span id={`${id}-name-limit`} className="px-1 text-sm text-[#e5484d]">Shorten the name to {NAME_LIMIT} characters</span> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3 px-1 text-sm text-muted">
          <label htmlFor={`${id}-description`}>Description</label>
          <span id={`${id}-description-count`} className={`tabular-nums${descriptionTooLong ? " text-[#e5484d]" : ""}`} aria-hidden>{description.length} / {DESCRIPTION_LIMIT}</span>
        </span>
        <textarea
          id={`${id}-description`}
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_LIMIT}
          aria-describedby={`${id}-description-count${descriptionTooLong ? ` ${id}-description-limit` : ""}`}
          aria-invalid={descriptionTooLong || undefined}
          rows={3}
          placeholder="Where, what to bring, anything guests should know"
          className="field min-h-24 resize-none"
        />
        {descriptionTooLong ? <span id={`${id}-description-limit`} className="px-1 text-sm text-[#e5484d]">Shorten the description to {DESCRIPTION_LIMIT} characters</span> : null}
      </div>

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
        <button type="button" onClick={() => setDeleting(true)} disabled={pending} className="btn btn-secondary text-[#e5484d]" aria-haspopup="dialog">
          Delete event
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="px-1 text-sm">
          {error}
        </p>
      ) : null}

      <BottomBar>
        <button type="submit" disabled={pending || nameTooLong || descriptionTooLong} aria-busy={pending} className={`btn btn-primary w-full${pending ? " shimmer-action" : ""}`}>
          {pending ? (event ? "Saving…" : "Creating…") : event ? "Save changes" : "Create event"}
        </button>
      </BottomBar>
      {event && deleting ? (
        <DeleteDialog title="Delete event?" confirmLabel="Delete event" onConfirm={remove} onClose={() => setDeleting(false)}>
          <span className="font-medium text-fg">“{event.title}”</span> and all its photos and videos will be permanently deleted for everyone
        </DeleteDialog>
      ) : null}
    </form>
  );
}
