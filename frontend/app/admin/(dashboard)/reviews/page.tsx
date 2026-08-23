"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Check, X, Trash2, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/admin-ui/badge";
import { Input } from "@/components/admin-ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/admin-ui/select";
import { api } from "../../_lib/api";
import { useInvalidate } from "../../_lib/invalidate";

type ReviewStatus = "pending" | "approved" | "rejected";

interface AdminReview {
  _id: string;
  product: { _id: string; name: string; slug: string; images: string[] } | null;
  author: string;
  email: string;
  rating: number;
  title?: string;
  body: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: string;
}

interface ReviewPage {
  items: AdminReview[];
  total: number;
  page: number;
  pages: number;
  pending: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= rating ? "fill-gold text-gold" : "text-obsidian/20"}
        />
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Reading what customers wrote before it goes on a product page.
 *
 * Reviews arrive pending and appear nowhere until approved. An open review box
 * on a small shop is a spam target, and nobody should learn what is on their
 * own product page by reading it.
 */
export default function ReviewsPage() {
  const invalidate = useInvalidate();
  const [status, setStatus] = useState<string>("pending");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams({ status, limit: "50" });
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", status, search],
    queryFn: () => api.get<ReviewPage>(`/reviews?${params}`),
  });

  // An approved review changes the product's score and the dashboard's queue.
  const refresh = invalidate.reviews;

  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ReviewStatus }) =>
      api.patch<AdminReview>(`/reviews/${id}`, { status: next }),
    onSuccess: (_r, { next }) => {
      toast.success(next === "approved" ? "Published on the product page" : `Marked ${next}`);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/reviews/${id}`),
    onSuccess: () => {
      toast.success("Review deleted");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviews = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Reviews</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          Nothing customers write appears on the site until you approve it. A product&rsquo;s star
          rating is worked out from the approved ones — it is never a figure anybody types.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or wording…"
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Waiting to be read</SelectItem>
            <SelectItem value="approved">Published</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        {data && data.pending > 0 && status !== "pending" && (
          <button
            onClick={() => setStatus("pending")}
            className="text-xs uppercase tracking-wide text-gold-dark hover:underline"
          >
            {data.pending} waiting
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-obsidian/45">Loading…</p>}

      {!isLoading && reviews.length === 0 && (
        <div className="rounded-lg border border-obsidian/10 bg-white px-5 py-14 text-center text-sm text-obsidian/50">
          {status === "pending"
            ? "Nothing waiting. Reviews appear here as customers write them."
            : "No reviews match that."}
        </div>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <article key={review._id} className="rounded-lg border border-obsidian/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={review.rating} />
                  <span className="text-sm font-medium text-obsidian">{review.author}</span>
                  {review.verifiedPurchase && (
                    <span
                      title="This email has an order containing this piece"
                      className="inline-flex items-center gap-1 text-xs text-green-700"
                    >
                      <BadgeCheck size={13} /> Verified purchase
                    </span>
                  )}
                  {review.status !== "pending" && (
                    <Badge tone={review.status === "approved" ? "in" : "out"}>
                      {review.status === "approved" ? "Published" : "Rejected"}
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-xs text-obsidian/45">
                  {review.email} · {formatDate(review.createdAt)}
                  {review.product && (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/products/${review.product._id}/edit`}
                        className="underline-offset-2 hover:underline"
                      >
                        {review.product.name}
                      </Link>
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {review.status !== "approved" && (
                  <button
                    onClick={() => moderate.mutate({ id: review._id, next: "approved" })}
                    disabled={moderate.isPending}
                    className="inline-flex items-center gap-1.5 rounded bg-obsidian px-3 py-2 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
                  >
                    <Check size={13} /> Publish
                  </button>
                )}
                {review.status !== "rejected" && (
                  <button
                    onClick={() => moderate.mutate({ id: review._id, next: "rejected" })}
                    disabled={moderate.isPending}
                    className="inline-flex items-center gap-1.5 rounded border border-obsidian/25 px-3 py-2 text-xs uppercase tracking-wide text-obsidian/70 hover:text-obsidian disabled:opacity-40"
                  >
                    <X size={13} /> Reject
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Permanently delete ${review.author}'s review?`)) {
                      remove.mutate(review._id);
                    }
                  }}
                  disabled={remove.isPending}
                  aria-label={`Delete ${review.author}'s review`}
                  className="rounded p-2 text-obsidian/40 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {review.title && (
              <p className="mt-3 text-sm font-medium text-obsidian">{review.title}</p>
            )}
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-obsidian/70">
              {review.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
