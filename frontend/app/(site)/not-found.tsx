import Link from "next/link";

/**
 * The storefront had no 404 page, so a mistyped address — or a product that has
 * been retired since someone bookmarked it — showed Next's stock developer 404
 * on a white page: no header, no branding, and no way onward except the back
 * button. A dead end is where a customer leaves.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-4 text-gold">404</p>

      <h1 className="mb-4 font-serif text-3xl md:text-4xl">We cannot find that page</h1>

      <p className="mb-8 text-ink-muted">
        It may have moved, or the piece you are looking for may no longer be available.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/shop" className="btn-primary">
          Browse the shop
        </Link>
        <Link href="/" className="btn-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
