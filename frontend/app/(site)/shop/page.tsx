import { fetchCategories, fetchFacets, fetchProducts, type ProductQuery } from "@/lib/api";
import { ShopView } from "@/components/shop/ShopView";

export const metadata = {
  title: "Shop — JULES & CO",
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Multi-select facets arrive as comma-separated values in the URL. */
function list(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value.join(",") : value;
  const parts = raw.split(",").filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function one(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

// Params the shop owns itself; everything else is treated as an attribute facet.
const RESERVED_PARAMS = new Set(["category", "minPrice", "maxPrice", "search", "sort"]);

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const category = one(searchParams.category) ?? "all";

  const query: ProductQuery = {
    category,
    minPrice: one(searchParams.minPrice) ? Number(one(searchParams.minPrice)) : undefined,
    maxPrice: one(searchParams.maxPrice) ? Number(one(searchParams.maxPrice)) : undefined,
    search: one(searchParams.search),
    sort: one(searchParams.sort),
  };

  // Attribute facets are passed straight through rather than named one by one.
  // A filter added in the admin therefore works without an edit here; the API
  // validates the keys against its own AttributeGroup records.
  Object.entries(searchParams).forEach(([key, value]) => {
    if (RESERVED_PARAMS.has(key)) return;
    const values = list(value);
    if (values) query[key] = values;
  });

  // Filtering and sorting happen in Mongo, not in the browser, so the shop can
  // scale past the handful of products the old mock array held.
  const [products, facets, categories] = await Promise.all([
    fetchProducts(query),
    fetchFacets(category),
    fetchCategories(),
  ]);

  return <ShopView products={products} facets={facets} categories={categories} />;
}
