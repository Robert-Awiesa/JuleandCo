"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { useWishlistStore } from "@/store/useWishlistStore";
import { ProductGrid } from "@/components/shop/ProductGrid";

export function WishlistView({ products }: { products: Product[] }) {
  const productIds = useWishlistStore((s) => s.productIds);

  // The store hydrates from localStorage after mount, so rendering its contents
  // on the first pass would mismatch the server-rendered empty state.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const saved = products.filter((p) => productIds.includes(p.id));

  return (
    <div className="container-elevated py-12">
      <p className="eyebrow mb-2">Saved Pieces</p>
      <h1 className="mb-10 font-serif text-4xl font-bold leading-[1.15]">Your Wishlist</h1>

      {!hydrated ? (
        <div className="py-20 text-center text-sm text-obsidian/40">Loading…</div>
      ) : saved.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-obsidian/50">Nothing saved yet.</p>
          <Link href="/shop" className="btn-primary">
            Browse the Collection
          </Link>
        </div>
      ) : (
        <ProductGrid products={saved} />
      )}
    </div>
  );
}
