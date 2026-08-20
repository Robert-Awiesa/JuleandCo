"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import type { FacetResponse, Product, StoreCategory } from "@/lib/types";
import { FilterSidebar } from "./FilterSidebar";
import { ProductGrid } from "./ProductGrid";

type SortOption = "featured" | "new" | "bestseller" | "price-asc" | "price-desc";

interface ShopViewProps {
  products: Product[];
  facets: FacetResponse;
  categories: StoreCategory[];
}

/**
 * Filter state lives in the URL, not in component state.
 *
 * Filtering used to run in the browser over a hardcoded array. Now the server
 * queries Mongo, so every filter change is a navigation: the URL is the single
 * source of truth, which also makes filtered views shareable and bookmarkable.
 */
export function ShopView({ products, facets, categories }: ShopViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const sort = (searchParams.get("sort") as SortOption | null) ?? "featured";

  const setParams = useCallback(
    (patch: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        const next = Array.isArray(value) ? value.join(",") : value;
        if (!next) params.delete(key);
        else params.set(key, next);
      });
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const handleReset = useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  return (
    <div className="container-elevated py-12">
      <div className="mb-10">
        <p className="eyebrow mb-2">Full Collection</p>
        {/* TODO(copy): placeholder heading — refine before launch. */}
        <h1 className="font-serif text-4xl">Shop the Collection</h1>
      </div>

      <div className="flex items-center justify-between border-y border-obsidian/10 py-4">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="flex items-center gap-2 text-sm lg:hidden"
        >
          <SlidersHorizontal size={15} /> Filters
        </button>
        <p className="hidden text-sm text-obsidian/50 lg:block">
          {isPending ? "Updating…" : `${products.length} ${products.length === 1 ? "piece" : "pieces"}`}
        </p>
        <select
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value === "featured" ? null : e.target.value })}
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
          <FilterSidebar facets={facets} categories={categories} onChange={setParams} onReset={handleReset} />
        </aside>

        <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="text-obsidian/50">Nothing matches these filters.</p>
              <button onClick={handleReset} className="text-sm underline underline-offset-4">
                Clear all filters
              </button>
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
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
              <FilterSidebar facets={facets} categories={categories} onChange={setParams} onReset={handleReset} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
