import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while the server's HTML is hydrating, true right after. Anything that depends on the viewer's time zone
 * or language renders the same as the server on the first pass, then switches: `suppressHydrationWarning` only
 * hides the mismatch warning, it never replaces the server's text.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
