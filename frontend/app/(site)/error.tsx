"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The storefront had no error boundary, so any thrown render — an API outage
 * mid-request being the realistic one — took the whole page to Next's stock
 * error screen. A shop that looks broken loses the sale even when the fault is
 * a few seconds long, and "Try again" recovers most of them.
 *
 * The message is never shown to the shopper: it is written for a developer and
 * can carry internals. It goes to the console, where it is useful.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-4 text-gold">Something went wrong</p>

      <h1 className="mb-4 font-serif text-3xl md:text-4xl">This page did not load</h1>

      <p className="mb-8 text-ink-muted">
        It is us, not you. Try again in a moment — and if it keeps happening, please get in
        touch and we will sort it out.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Back to home
        </Link>
      </div>

      {error.digest && (
        // Gives support something to search the logs for without exposing the
        // error itself.
        <p className="mt-8 text-xs text-ink-subtle">Reference: {error.digest}</p>
      )}
    </div>
  );
}
