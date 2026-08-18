"use client";

import Link from "next/link";
import { products } from "@/lib/mockData";
import { useWishlistStore } from "@/store/useWishlistStore";
import { ProductGrid } from "@/components/shop/ProductGrid";

export default function WishlistPage() {
  const productIds = useWishlistStore((s) => s.productIds);
  const saved = products.filter((p) => productIds.includes(p.id));

  return (
    <div className="container-elevated py-12">
      <p className="eyebrow mb-2">Saved Pieces</p>
      <h1 className="mb-10 font-serif text-4xl">Your Wishlist</h1>

      {saved.length === 0 ? (
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
