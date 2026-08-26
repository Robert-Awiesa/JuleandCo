import { notFound } from "next/navigation";

/**
 * Catches any address that matches no other route, and hands it to the
 * storefront's own 404 page.
 *
 * Without this, an unmatched URL falls outside every route group — and since
 * this app's root layout lives *inside* the `(site)` group (the admin has its
 * own), Next has no root layout to render a top-level `not-found.tsx` with. It
 * refuses the file at build time, and serves its stock white error page
 * instead: no branding, no header, no way onward.
 *
 * A catch-all inside the group has a layout, so `notFound()` here renders the
 * real 404 with the header, footer and cart exactly like any other page. It
 * matches last by definition, so no genuine route is shadowed by it.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
