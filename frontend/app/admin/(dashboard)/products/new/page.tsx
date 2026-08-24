import { Suspense } from "react";
import { ProductForm } from "../../../_components/products/ProductForm";

/**
 * The form reads `?tab=` so "Restock" on the product list can open straight on
 * the inventory grid. `useSearchParams()` opts a component out of static
 * rendering, and Next refuses to prerender a page containing one without a
 * boundary to render while the params resolve — the build fails outright rather
 * than shipping a page that flashes empty.
 */
export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-sm text-obsidian/50">Loading…</p>}>
      <ProductForm />
    </Suspense>
  );
}
