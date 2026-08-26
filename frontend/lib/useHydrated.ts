"use client";

import { useEffect, useState } from "react";

/**
 * False during the first client render, true afterwards.
 *
 * The cart and the wishlist persist to localStorage, which the server cannot
 * see. So the server renders an empty bag and the browser's first render — the
 * one React matches against that HTML — renders whatever the shopper actually
 * had. React calls that a hydration mismatch and, because it happens outside a
 * Suspense boundary, throws the **entire page** away and re-renders it on the
 * client: server rendering is wasted, and the page visibly flickers.
 *
 * Gating on this makes the first render match the server, and the real value
 * appears immediately after. It costs one extra render and nothing else.
 *
 * Use it wherever persisted state decides what is *rendered*, not merely what
 * happens on click — a click handler reads the store at click time, long after
 * hydration, and needs no gate.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
