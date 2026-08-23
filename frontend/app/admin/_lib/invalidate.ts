"use client";

import { useMemo } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * What to refetch after a change, named by the change rather than by the cache.
 *
 * Every mutation used to hand-pick its own query keys, which drifted: saving a
 * product refreshed the product list but not the dashboard tiles, and retiring
 * a category refreshed the categories page while the product form kept offering
 * it from a five-minute cache. The screens that went stale were never the ones
 * you were looking at, so it read as the dashboard lying rather than caching.
 *
 * A change is declared once here, and a caller says what happened rather than
 * guessing what depends on it. Keys are invalidated by prefix, so
 * ["admin-products"] covers the list, the dashboard tiles and the cross-sell
 * picker without naming each.
 */

/** Query key prefixes, so a typo is a compile error rather than a silent no-op. */
export const QK = {
  products: ["admin-products"] as const,
  product: ["admin-product"] as const,
  orders: ["admin-orders"] as const,
  orderStats: ["order-stats"] as const,
  categories: ["categories"] as const,
  subcategories: ["subcategories"] as const,
  attributeGroups: ["attribute-groups"] as const,
  attributes: ["attributes"] as const,
  content: ["content"] as const,
  contentSlots: ["content-slots"] as const,
  recentUploads: ["recent-uploads"] as const,
};

function invalidateAll(client: QueryClient, keys: readonly (readonly string[])[]) {
  keys.forEach((queryKey) => client.invalidateQueries({ queryKey: [...queryKey] }));
}

export function useInvalidate() {
  const client = useQueryClient();

  return useMemo(
    () => ({
      /** A product was created, edited, duplicated, deleted or re-stocked. */
      catalogue: () =>
        invalidateAll(client, [QK.products, QK.product]),

      /**
       * An order was placed, advanced or cancelled. Cancelling returns stock to
       * the catalogue, so the product figures move too.
       */
      orders: () => invalidateAll(client, [QK.orders, QK.orderStats, QK.products]),

      /**
       * A category, sub-category, attribute group or attribute changed. The
       * product list and form both read this configuration — a retired category
       * changes what a product may be saved as, not just what the Categories
       * page shows.
       */
      configuration: () =>
        invalidateAll(client, [
          QK.categories,
          QK.subcategories,
          QK.attributeGroups,
          QK.attributes,
          QK.products,
          QK.product,
        ]),

      /** Site content was saved or restored. */
      content: () => invalidateAll(client, [QK.content, QK.contentSlots]),

      /** A new image was uploaded, so "Reuse a shot" has one more to offer. */
      uploads: () => invalidateAll(client, [QK.recentUploads]),
    }),
    [client]
  );
}
