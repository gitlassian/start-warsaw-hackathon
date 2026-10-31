// Exact URLs only: a changed image or a renewed signed URL must load successfully again.
const loaded = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
const MAX_IMAGES = 512;

export function isImageLoaded(src: string) {
  return loaded.has(src);
}

export function subscribeToImage(src: string, listener: () => void) {
  const subscribers = listeners.get(src) ?? new Set();
  subscribers.add(listener);
  listeners.set(src, subscribers);
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) listeners.delete(src);
  };
}

export function rememberImage(src: string) {
  if (loaded.has(src)) return;
  loaded.add(src);
  if (loaded.size > MAX_IMAGES) {
    const oldest = loaded.values().next().value!;
    loaded.delete(oldest);
    listeners.get(oldest)?.forEach((listener) => listener());
  }
  listeners.get(src)?.forEach((listener) => listener());
}

export function forgetImage(src: string) {
  if (loaded.delete(src)) listeners.get(src)?.forEach((listener) => listener());
}
