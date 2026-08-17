import { FilterState, Product } from "./types";

export function filterProducts(products: Product[], filters: FilterState): Product[] {
  return products.filter((p) => {
    if (filters.category !== "all" && p.category !== filters.category) return false;

    if (filters.frameShapes.length && !filters.frameShapes.includes(p.frameShape ?? ""))
      return false;

    if (filters.lensColors.length && !filters.lensColors.includes(p.lensColor ?? ""))
      return false;

    if (
      filters.sizes.length &&
      !(p.clothingSize ?? []).some((s) => filters.sizes.includes(s))
    )
      return false;

    if (filters.fabrics.length) {
      const matchesFabric = filters.fabrics.some((f) =>
        (p.fabric ?? "").toLowerCase().includes(f.toLowerCase())
      );
      if (!matchesFabric) return false;
    }

    if (p.price < filters.priceRange[0] || p.price > filters.priceRange[1]) return false;

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const haystack = `${p.name} ${p.subCategory} ${p.fabric ?? ""} ${p.frameShape ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}
