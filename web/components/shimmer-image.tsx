"use client";

import { useCallback, useState, useSyncExternalStore, type ComponentProps } from "react";
import { Images } from "@/components/icons";
import { forgetImage, isImageLoaded, rememberImage, subscribeToImage } from "@/lib/image-cache";

type ImageProps = Omit<ComponentProps<"img">, "ref" | "onLoad" | "onError" | "src"> & {
  src: string;
  imageClassName?: string;
};

const serverSnapshot = () => false;

/** Reuses successful loads across remounts without changing the server's hydration snapshot. */
export function ShimmerImage({ src, alt, className = "", imageClassName = "", ...props }: ImageProps) {
  const subscribe = useCallback((listener: () => void) => subscribeToImage(src, listener), [src]);
  const getSnapshot = useCallback(() => isImageLoaded(src), [src]);
  const cached = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const [result, setResult] = useState<{ src: string; state: "loaded" | "error" } | null>(null);
  const state = result?.src === src ? result.state : cached ? "loaded" : "loading";
  const settle = useCallback((success: boolean) => {
    if (success) rememberImage(src);
    else forgetImage(src);
    setResult({ src, state: success ? "loaded" : "error" });
  }, [src]);
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    // Cached images may finish before hydration attaches onLoad.
    if (image?.complete) settle(image.naturalWidth > 0);
  }, [settle]);

  return (
    <span className={`shimmer-image ${className}`} data-state={state} aria-busy={state === "loading"}>
      <img
        {...props}
        ref={imageRef}
        src={src}
        alt={alt}
        aria-hidden={state === "error" ? true : props["aria-hidden"]}
        className={imageClassName}
        onLoad={() => settle(true)}
        onError={() => settle(false)}
      />
      {state === "loading" ? <span className="shimmer" aria-hidden="true" /> : null}
      {state === "error" ? <span className="shimmer-image-error" role={alt ? "img" : undefined} aria-label={alt ? `${alt}. Image unavailable` : undefined} aria-hidden={alt ? undefined : true}><Images size={24} strokeWidth={1.5} /></span> : null}
    </span>
  );
}
