"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency } from "@/lib/utils";
import { trackPurchase } from "@/lib/track";

type Status = "checking" | "paid" | "failed" | "unknown";

interface PaymentState {
  orderNumber: string;
  paymentStatus: "pending" | "paid" | "failed";
  totalPrice: number;
  status: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * What the customer sees when Paystack sends them back.
 *
 * **This page does not decide whether payment succeeded.** It asks the API,
 * which asks Paystack. The redirect can be forged or replayed, and a browser
 * saying "it worked" is not evidence that money moved.
 *
 * The webhook usually lands first, but it is a separate HTTP call and can lag a
 * second or two — so this polls briefly rather than declaring failure on a race
 * it was always going to sometimes lose.
 */
export function PaymentResult() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";

  const [status, setStatus] = useState<Status>("checking");
  const [order, setOrder] = useState<PaymentState | null>(null);
  const clearCart = useCartStore((s) => s.clear);
  const cleared = useRef(false);

  useEffect(() => {
    if (!reference) {
      setStatus("unknown");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    async function check() {
      attempts += 1;

      try {
        const res = await fetch(`${API}/payments/status/${encodeURIComponent(reference)}`);
        if (!res.ok) throw new Error();

        const body: PaymentState = await res.json();
        if (cancelled) return;

        setOrder(body);

        if (body.paymentStatus === "paid") {
          setStatus("paid");
          // Emptied only once payment is confirmed. An abandoned payment leaves
          // the basket intact so the customer can try again rather than
          // rebuilding it from memory.
          if (!cleared.current) {
            cleared.current = true;
            clearCart();
            // Recorded once, beside the clear, because both must happen exactly
            // once per confirmed payment — the page polls, so anything outside
            // this guard would fire on every attempt.
            trackPurchase(body);
          }
          return;
        }

        if (body.paymentStatus === "failed") {
          setStatus("failed");
          return;
        }

        // Still pending: give the webhook a moment before giving up on it.
        if (attempts < 6) {
          setTimeout(check, 1500);
        } else {
          setStatus("unknown");
        }
      } catch {
        if (cancelled) return;
        if (attempts < 6) setTimeout(check, 1500);
        else setStatus("unknown");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [reference, clearCart]);

  return (
    <div className="container-elevated flex min-h-[60vh] items-center justify-center py-24">
      <div className="max-w-md text-center">
        {status === "checking" && (
          <>
            <Loader2 size={32} className="mx-auto animate-spin text-gold" />
            <h1 className="mt-6 font-serif text-2xl text-ink">Confirming your payment…</h1>
            <p className="mt-3 text-sm text-ink-muted">
              This takes a moment. Please do not close this page.
            </p>
          </>
        )}

        {status === "paid" && order && (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-surface">
              <Check size={26} />
            </span>
            <h1 className="mt-6 font-serif text-3xl text-ink">Thank you</h1>
            <p className="mt-3 text-ink-muted">
              Your payment of {formatCurrency(order.totalPrice)} went through, and your order is
              confirmed.
            </p>
            <p className="numeric mt-6 border border-line px-4 py-3 text-sm text-ink">
              Order {order.orderNumber}
            </p>
            <p className="mt-4 text-sm text-ink-subtle">
              We will be in touch about delivery before anything is dispatched.
            </p>
            <Link href="/shop" className="btn-primary mt-8">
              Continue shopping
            </Link>
          </>
        )}

        {status === "failed" && (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line-strong text-ink-muted">
              <X size={26} />
            </span>
            <h1 className="mt-6 font-serif text-2xl text-ink">That payment did not go through</h1>
            <p className="mt-3 text-sm text-ink-muted">
              Nothing has been charged. Your basket is still here — you can try again.
            </p>
            {order && (
              <p className="numeric mt-6 text-xs text-ink-subtle">Order {order.orderNumber}</p>
            )}
            <Link href="/checkout" className="btn-primary mt-8">
              Try again
            </Link>
          </>
        )}

        {status === "unknown" && (
          <>
            <h1 className="font-serif text-2xl text-ink">We are still checking</h1>
            <p className="mt-3 text-sm text-ink-muted">
              Your payment may still be going through. Nothing is lost — if money left your
              account, your order is safe and we will confirm it.
            </p>
            {reference && (
              <p className="numeric mt-6 text-xs text-ink-subtle">Reference {reference}</p>
            )}
            <p className="mt-4 text-sm text-ink-subtle">
              Contact us with that reference if you do not hear from us.
            </p>
            <Link href="/shop" className="btn-secondary mt-8">
              Back to the shop
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
