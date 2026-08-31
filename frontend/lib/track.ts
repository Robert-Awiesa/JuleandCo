"use client";

/**
 * Sending an e-commerce event, when analytics is configured at all.
 *
 * A thin wrapper rather than calling `gtag` directly, so a page never has to
 * know whether analytics exists: with no measurement ID nothing is loaded,
 * `window.gtag` is undefined, and this quietly does nothing.
 *
 * Purchases are the events worth the trouble. Page views arrive on their own;
 * what a shop actually needs to know is what sold and for how much.
 */
type GtagWindow = Window & {
  gtag?: (command: string, event: string, params?: Record<string, unknown>) => void;
};

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const gtag = (window as GtagWindow).gtag;
  if (typeof gtag !== "function") return;

  try {
    gtag("event", event, params);
  } catch {
    // Measurement must never break a page — least of all the one confirming
    // that somebody's money went through.
  }
}

export function trackPurchase(order: {
  orderNumber: string;
  totalPrice: number;
  items?: { name: string; price: number; quantity: number }[];
}) {
  track("purchase", {
    transaction_id: order.orderNumber,
    value: order.totalPrice,
    currency: "GHS",
    items: (order.items ?? []).map((item) => ({
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  });
}
