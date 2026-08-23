"use client";

import { useState } from "react";
import { Star, BadgeCheck } from "lucide-react";

export interface PublicReview {
  _id: string;
  author: string;
  rating: number;
  title?: string;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(rating) ? "fill-gold text-gold" : "text-ink-subtle/40"}
        />
      ))}
    </span>
  );
}

/** The star picker on the form — a control, so it has to be operable by keyboard. */
function RatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="flex h-11 w-11 items-center justify-center rounded transition-colors hover:bg-surface-raised"
        >
          <Star size={20} className={n <= value ? "fill-gold text-gold" : "text-ink-subtle/40"} />
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * What customers said about a piece, and the form to add to it.
 *
 * Reviews are read by a person before they appear, so a submission is
 * acknowledged rather than shown — telling someone their words are live when
 * they are not would be a small lie the page can avoid.
 */
export function ProductReviews({
  productId,
  reviews,
  rating,
  reviewCount,
}: {
  productId: string;
  reviews: PublicReview[];
  rating?: number;
  reviewCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ author: "", email: "", rating: 5, title: "", body: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || "That could not be sent.");

      setSent(data.message);
      setOpen(false);
      setDraft({ author: "", email: "", rating: 5, title: "", body: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "w-full border border-line-strong bg-transparent px-4 py-3 text-sm placeholder:text-ink-subtle focus:border-gold focus:outline-none";

  return (
    <section className="container-elevated border-t border-line py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3 text-gold">Reviews</p>
          {reviewCount && reviewCount > 0 && rating ? (
            <div className="flex items-center gap-3">
              <Stars rating={rating} size={18} />
              <span className="numeric text-lg text-ink">{rating.toFixed(1)}</span>
              <span className="text-sm text-ink-muted">
                from {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          ) : (
            <h2 className="font-serif text-2xl text-ink">No reviews yet</h2>
          )}
        </div>

        {!open && (
          <button onClick={() => setOpen(true)} className="btn-secondary">
            Write a review
          </button>
        )}
      </div>

      {sent && (
        <p role="status" className="mt-6 border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-ink">
          {sent}
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-8 max-w-xl space-y-4">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-widest2 text-ink-subtle">
              Your rating
            </span>
            <RatingInput value={draft.rating} onChange={(n) => setDraft({ ...draft, rating: n })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              required
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              placeholder="Your name"
              aria-label="Your name"
              className={inputClass}
            />
            <input
              required
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Your email"
              aria-label="Your email"
              className={inputClass}
            />
          </div>

          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="A headline (optional)"
            aria-label="A headline"
            className={inputClass}
          />

          <textarea
            required
            rows={4}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="What did you think of it?"
            aria-label="Your review"
            className={inputClass}
          />

          <p className="text-xs text-ink-subtle">
            Your email is only used to check the order and is never published.
          </p>

          {error && (
            <p role="alert" className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-ink">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={sending} className="btn-primary disabled:opacity-60">
              {sending ? "Sending…" : "Submit review"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="py-3 text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {reviews.length > 0 && (
        <ul className="mt-12 divide-y divide-line">
          {reviews.map((review) => (
            <li key={review._id} className="py-6">
              <div className="flex flex-wrap items-center gap-3">
                <Stars rating={review.rating} />
                <span className="text-sm font-medium text-ink">{review.author}</span>
                {review.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 text-xs text-gold">
                    <BadgeCheck size={13} /> Verified purchase
                  </span>
                )}
                <span className="text-xs text-ink-subtle">{formatDate(review.createdAt)}</span>
              </div>

              {review.title && <p className="mt-2 font-medium text-ink">{review.title}</p>}
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                {review.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
