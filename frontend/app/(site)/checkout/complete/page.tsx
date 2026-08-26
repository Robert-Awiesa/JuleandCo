import { Suspense } from "react";
import { PaymentResult } from "@/components/checkout/PaymentResult";

/**
 * Where Paystack sends the customer back to.
 *
 * The reference arrives as a query parameter, and reading it opts this out of
 * static rendering — hence the boundary, which Next requires rather than
 * letting the page flash empty.
 */
export default function CheckoutCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="container-elevated py-24 text-center">
          <p className="text-ink-muted">Checking your payment…</p>
        </div>
      }
    >
      <PaymentResult />
    </Suspense>
  );
}
