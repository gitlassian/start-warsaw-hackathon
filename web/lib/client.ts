/** Browser-side call to FastAPI through the /api rewrite. Throws with the server's message. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Something went wrong. Try again.");
  return data;
}

/** Downscale for thumbnails and covers so the grid stays light on mobile data. */
async function resize(file: Blob, max: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
  if (!blob) throw new Error("Could not process image");
  return blob;
}

async function putAll(blobs: Blob[]): Promise<string[]> {
  const targets = await api<{ key: string; url: string }[]>("/api/uploads", {
    body: { types: blobs.map((b) => b.type) },
  });
  await Promise.all(
    targets.map(async (t, i) => {
      const res = await fetch(t.url, { method: "PUT", body: blobs[i], headers: { "content-type": blobs[i].type } });
      if (!res.ok) throw new Error("Upload failed");
    }),
  );
  return targets.map((t) => t.key);
}

// Some pickers hand over files with no type (e.g. HEIC on desktop).
const typed = (file: File): Blob => (file.type ? file : new Blob([file], { type: "image/jpeg" }));

export async function uploadCover(file: File): Promise<string> {
  const [key] = await putAll([await resize(file, 1600).catch(() => typed(file))]);
  return key;
}

export async function uploadPhoto(eventId: number, file: File) {
  const thumb = await resize(file, 600).catch(() => null); // undecodable here (HEIC on Chrome): grid shows the original
  const [key, thumbKey = key] = await putAll(thumb ? [typed(file), thumb] : [typed(file)]);
  return api(`/api/events/${eventId}/photos`, { body: { key, thumb_key: thumbKey } });
}
