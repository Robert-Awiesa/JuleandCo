import type { FacetResponse, Product } from "./types";

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
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function getJson<T>(path: string, fallback: T): Promise<T> {
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

export interface ProductQuery {
  category?: string;
  subCategory?: string[];
  frameShape?: string[];
  frameMaterial?: string[];
  lensType?: string[];
  gender?: string[];
  fit?: string[];
  fabric?: string[];
  size?: string[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: string;
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
  return getJson<FacetResponse>(`/products/facets${qs}`, {
    groups: {
      frameShape: [],
      frameMaterial: [],
      lensType: [],
      gender: [],
      fit: [],
      fabric: [],
      clothingSize: [],
    },
    subCategories: [],
    priceBounds: [0, 0],
  });
}
