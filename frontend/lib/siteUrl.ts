/**
 * The shop's own public address.
 *
 * Needed wherever a URL has to be absolute rather than relative:
 *
 *   - `metadataBase`, without which a share image like `/images/brand/og-image.jpg`
 *     stays relative. WhatsApp, Facebook and X all require an absolute og:image,
 *     so a shared link previews with no picture — which for a shop that will be
 *     passed around on WhatsApp is most of the point of sharing it.
 *   - robots.txt and the sitemap, which name absolute URLs by specification.
 *
 * Resolved the same way the Paystack return URL is, and for the same reason:
 * an operator's own domain wins, Vercel's own deployment hostname covers things
 * before a domain exists, and localhost is the development fallback. Nothing
 * here trusts a request header.
 */
const FALLBACK = "http://localhost:3000";

function normalise(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().split(",")[0].trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function siteUrl(): string {
  return (
    normalise(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalise(process.env.CLIENT_URL) ||
    // The project's stable production domain, ahead of this one deployment's
    // immutable hostname — otherwise robots.txt, the sitemap and every
    // canonical advertise a URL that changes on every deploy.
    normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalise(process.env.VERCEL_URL) ||
    FALLBACK
  );
}

/** The same, as a URL — which is the shape `metadataBase` wants. */
export function siteUrlObject(): URL {
  return new URL(siteUrl());
}
