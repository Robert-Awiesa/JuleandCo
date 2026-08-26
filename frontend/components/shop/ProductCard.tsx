"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Heart } from "lucide-react";
import { Product } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { PriceTag } from "@/components/ui/PriceTag";
import { discountPercent, stockLabel } from "@/lib/utils";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useHydrated } from "@/lib/useHydrated";
import { QuickViewModal } from "./QuickViewModal";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  // The wishlist is in localStorage, so the server always renders an unfilled
  // heart. Rendering a filled one on the first client pass is a hydration
  // mismatch, and one product card is enough to re-render the whole shop.
  const hydrated = useHydrated();
  const saved = useWishlistStore((s) => s.has(product.id));
  const wishlisted = hydrated && saved;
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const stock = stockLabel(product.stock);
  const discount = discountPercent(product.price, product.compareAtPrice);

  return (
    <>
      <div className="group relative">
        <div className="relative aspect-[3/4] overflow-hidden bg-surface-tile">
          <Link href={`/product/${product.slug}`} className="absolute inset-0 block">
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-opacity duration-500 group-hover:opacity-0"
            />
            <Image
              src={product.images[1] ?? product.images[0]}
              alt={`${product.name} alternate view`}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          </Link>

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {/* First in the stack: a reduction is the thing that makes someone
                look twice, and the struck-through price alone is easy to miss. */}
            {discount !== null && <Badge tone="sale">{discount}% Off</Badge>}
            {product.isNewArrival && <Badge tone="sage">New</Badge>}
            {product.isBestSeller && <Badge tone="gold">Best Seller</Badge>}
            {stock.tone !== "in" && (
              <Badge tone={stock.tone === "out" ? "obsidian" : "low"}>{stock.label}</Badge>
            )}
          </div>

          <button
            onClick={() => toggleWishlist(product.id)}
            aria-label="Toggle wishlist"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-surface/80 text-ink backdrop-blur-sm transition-transform hover:scale-105"
          >
            <Heart size={14} fill={wishlisted ? "#CDAD54" : "none"} />
          </button>

          <button
            onClick={() => setQuickViewOpen(true)}
            className="absolute inset-x-3 bottom-3 flex translate-y-3 items-center justify-center gap-2 bg-surface/90 py-3 text-xs font-medium uppercase tracking-wide text-ink opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Eye size={14} /> Quick View
          </button>
        </div>

        <Link href={`/product/${product.slug}`} className="mt-4 block">
          <p className="text-xs uppercase tracking-widest2 text-ink-subtle">
            {product.subCategory}
          </p>
          <h3 className="mt-1 font-serif text-lg">{product.name}</h3>
          <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} className="mt-1" />
          {product.tags && product.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag} tone="sage">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </Link>
      </div>

      <QuickViewModal
        product={product}
        isOpen={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
      />
    </>
  );
}
