import { fetchFacets, fetchProducts, type ProductQuery } from "@/lib/api";
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

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const category = one(searchParams.category) ?? "all";

  const query: ProductQuery = {
    category,
    subCategory: list(searchParams.subCategory),
    frameShape: list(searchParams.frameShape),
    frameMaterial: list(searchParams.frameMaterial),
    lensType: list(searchParams.lensType),
    gender: list(searchParams.gender),
    fit: list(searchParams.fit),
    fabric: list(searchParams.fabric),
    size: list(searchParams.size),
    minPrice: one(searchParams.minPrice) ? Number(one(searchParams.minPrice)) : undefined,
    maxPrice: one(searchParams.maxPrice) ? Number(one(searchParams.maxPrice)) : undefined,
    search: one(searchParams.search),
    sort: one(searchParams.sort),
  };

  // Filtering and sorting happen in Mongo, not in the browser, so the shop can
  // scale past the handful of products the old mock array held.
  const [products, facets] = await Promise.all([fetchProducts(query), fetchFacets(category)]);

  return <ShopView products={products} facets={facets} />;
}
