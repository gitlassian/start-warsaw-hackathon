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

const VIDEO_TYPES: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
const isVideo = (file: File) => file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);

// Some pickers hand over files with no type (e.g. HEIC on desktop).
const typed = (file: File): Blob =>
  file.type
    ? file
    : new Blob([file], { type: VIDEO_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "image/jpeg" });

/** A frame from the start of the video as a thumbnail; fails when the browser can't decode it (e.g. HEVC in Chrome). */
async function videoPoster(file: Blob, max: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      const timer = setTimeout(() => fail(new Error("Timed out reading the video")), 8000);
      video.onloadeddata = () => (video.currentTime = Math.min(0.5, (video.duration || 1) / 2));
      video.onseeked = () => (clearTimeout(timer), ok());
      video.onerror = () => (clearTimeout(timer), fail(new Error("Could not decode the video")));
    });
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) throw new Error("Could not process video");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadCover(file: File): Promise<string> {
  const [key] = await putAll([await resize(file, 1600).catch(() => typed(file))]);
  return key;
}

export async function uploadPhoto(eventId: number, file: File) {
  // undecodable here (HEIC or HEVC on Chrome): the server makes the thumbnail, or the grid shows a placeholder
  const thumb = await (isVideo(file) ? videoPoster(file, 600) : resize(file, 600)).catch(() => null);
  const [key, thumbKey = key] = await putAll(thumb ? [typed(file), thumb] : [typed(file)]);
  return api(`/api/events/${eventId}/photos`, { body: { key, thumb_key: thumbKey } });
}
