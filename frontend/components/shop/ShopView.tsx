"use client";

import { useEffect, useMemo, useState } from "react";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { products, priceBounds } from "@/lib/mockData";
import { filterProducts } from "@/lib/filterProducts";
import { FilterState, ProductCategory } from "@/lib/types";
import { FilterSidebar } from "./FilterSidebar";
import { ProductGrid } from "./ProductGrid";

const defaultFilters: FilterState = {
  category: "all",
  frameShapes: [],
  lensColors: [],
  sizes: [],
  fabrics: [],
  priceRange: priceBounds,
  search: "",
};

type SortOption = "featured" | "new" | "bestseller" | "price-asc" | "price-desc";

function filtersFromParams(searchParams: ReadonlyURLSearchParams): FilterState {
  return {
    ...defaultFilters,
    category: (searchParams.get("category") as ProductCategory | null) ?? "all",
    frameShapes: searchParams.get("frameShape") ? [searchParams.get("frameShape") as string] : [],
    fabrics: searchParams.get("fabric") ? [searchParams.get("fabric") as string] : [],
  };
}

export function ShopView() {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() => filtersFromParams(searchParams));
  const [sort, setSort] = useState<SortOption>(
    (searchParams.get("sort") as SortOption | null) ?? "featured"
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Re-sync filters when the URL's query string changes (e.g. a header nav
  // link to /shop?category=eyewear while already on /shop) — the page
  // component instance persists across search-param-only navigations, so
  // the useState initializer above only runs once and won't pick this up.
  useEffect(() => {
    setFilters(filtersFromParams(searchParams));
    setSort((searchParams.get("sort") as SortOption | null) ?? "featured");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    const results = filterProducts(products, filters);
    switch (sort) {
      case "new":
        return [...results].sort((a, b) => Number(b.isNew) - Number(a.isNew));
      case "bestseller":
        return [...results].sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));
      case "price-asc":
        return [...results].sort((a, b) => a.price - b.price);
      case "price-desc":
        return [...results].sort((a, b) => b.price - a.price);
      default:
        return results;
    }
  }, [filters, sort]);

  const handleChange = (patch: Partial<FilterState>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const handleReset = () => setFilters(defaultFilters);

  return (
    <div className="container-elevated py-12">
      <div className="mb-10">
        <p className="eyebrow mb-2">Full Collection</p>
        <h1 className="font-serif text-4xl">Shop Eyewear &amp; Apparel</h1>
      </div>

      <div className="flex items-center justify-between border-y border-obsidian/10 py-4">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="flex items-center gap-2 text-sm lg:hidden"
        >
          <SlidersHorizontal size={15} /> Filters
        </button>
        <p className="hidden text-sm text-obsidian/50 lg:block">
          {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
        </p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="border-none bg-transparent text-sm focus:outline-none"
        >
          <option value="featured">Sort: Featured</option>
          <option value="new">Newest</option>
          <option value="bestseller">Best Sellers</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <FilterSidebar filters={filters} onChange={handleChange} onReset={handleReset} />
        </aside>

        <ProductGrid products={filtered} />
      </div>

      <AnimatePresence>
        {mobileFiltersOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[85] bg-obsidian/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFiltersOpen(false)}
            />
            <motion.div
              className="fixed left-0 top-0 z-[86] h-full w-[85%] max-w-xs overflow-y-auto bg-alabaster p-6 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-medium">Filters</span>
                <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">
                  <X size={18} />
                </button>
              </div>
              <FilterSidebar filters={filters} onChange={handleChange} onReset={handleReset} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
