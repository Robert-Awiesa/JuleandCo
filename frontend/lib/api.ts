import type { FacetResponse, Product, StoreCategory } from "./types";

/**
 * Storefront data layer.
 *
 * The public site used to render `lib/mockData.ts`, a hardcoded file, which
 * meant nothing entered in the admin dashboard ever reached a customer. These
 * helpers run on the server (App Router server components), so the browser
 * never talks to the API directly and the API base URL stays server-side.
 *
 * The API only ever returns products with publishStatus "published", so drafts
 * are filtered out before they reach this layer.
 */
/**
 * Server-side calls go straight to the API. NEXT_PUBLIC_API_URL is "/api" in
 * production so the browser stays same-origin, but a relative URL is
 * meaningless inside a server component — hence API_ORIGIN.
 */
function normaliseOrigin(value?: string) {
  if (!value) return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  // Render hands over a bare hostname; accept it with or without a scheme.
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const API_ORIGIN = normaliseOrigin(process.env.API_ORIGIN);
const API_URL = API_ORIGIN
  ? `${API_ORIGIN}/api`
  : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    // Deliberately uncached.
    //
    // A revalidate window meant an admin could publish a product, reload the
    // shop, and not see it — indistinguishable from a bug, and it made the
    // storefront e2e test flaky against its own admin steps. At this catalogue
    // size a query per render is cheap, and "what the admin saved is what the
    // customer sees" is worth more than the cache.
    //
    // If traffic later justifies caching, swap this for
    // `next: { revalidate: N, tags: ["catalog"] }` and call revalidateTag
    // from the admin save path so publishing still takes effect immediately.
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`[storefront] ${path} responded ${res.status}`);
      }
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    // A storefront that 500s because the API is briefly down is worse than one
    // that renders an empty shelf, so degrade rather than throw.
    console.error(`[storefront] ${path} failed:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

/**
 * Filter params. The fixed facet keys are gone: which attributes are filterable
 * is defined by AttributeGroup records, so the shop passes through whatever the
 * facets endpoint advertised rather than a hardcoded list.
 */
export interface ProductQuery {
  category?: string;
  subCategory?: string[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: string;
  /** Any attribute group key advertised by /products/facets. */
  [attributeGroup: string]: string | string[] | number | undefined;
}

function toQueryString(query: ProductQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    // The API accepts comma-separated values for multi-select facets.
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchProducts(query: ProductQuery = {}): Promise<Product[]> {
  return getJson<Product[]>(`/products${toQueryString(query)}`, []);
}

/** Product detail plus its published "Complete the Look" pairings. */
export function fetchProductBySlug(
  slug: string
): Promise<(Product & { related: Product[] }) | null> {
  return getJson<(Product & { related: Product[] }) | null>(
    `/products/slug/${encodeURIComponent(slug)}`,
    null
  );
}

/** Filter options actually present in the published catalogue, already labelled. */
export function fetchFacets(category?: string): Promise<FacetResponse> {
  const qs = category && category !== "all" ? `?category=${category}` : "";
  // An open shape, so a facet added in the admin needs no change here.
  return getJson<FacetResponse>(`/products/facets${qs}`, {
    groups: {},
    groupMeta: [],
    counts: {},
    subCategories: [],
    priceBounds: [0, 0],
  });
}

/** Active categories, for the shop filters and navigation. */
export function fetchCategories(): Promise<StoreCategory[]> {
  // Param name must match categoryController: activeOnly, not active. With the
// wrong key the filter is silently ignored and retired categories show up as
// shop filters with nothing behind them.
  return getJson<StoreCategory[]>("/categories?activeOnly=true", []);
}

/**
 * Approved reviews for a product. Pending ones are invisible here — the API
 * only ever returns what an admin has read and published.
 */
export async function fetchProductReviews(productId: string) {
  return getJson<import("@/components/product/ProductReviews").PublicReview[]>(
    `/products/${productId}/reviews`,
    []
  );
}
