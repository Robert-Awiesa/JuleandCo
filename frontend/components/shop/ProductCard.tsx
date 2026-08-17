"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Heart } from "lucide-react";
import { Product } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { PriceTag } from "@/components/ui/PriceTag";
import { stockLabel } from "@/lib/utils";
import { useWishlistStore } from "@/store/useWishlistStore";
import { QuickViewModal } from "./QuickViewModal";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const wishlisted = useWishlistStore((s) => s.has(product.id));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const stock = stockLabel(product.stock);

  return (
    <>
      <div className="group relative">
        <div className="relative aspect-[3/4] overflow-hidden bg-obsidian/5">
          <Link href={`/product/${product.slug}`}>
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
            {product.isNew && <Badge tone="sage">New</Badge>}
            {product.isBestSeller && <Badge tone="gold">Best Seller</Badge>}
            {stock.tone !== "in" && (
              <Badge tone={stock.tone === "out" ? "obsidian" : "low"}>{stock.label}</Badge>
            )}
          </div>

          <button
            onClick={() => toggleWishlist(product.id)}
            aria-label="Toggle wishlist"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-alabaster/90 text-obsidian transition-transform hover:scale-105"
          >
            <Heart size={14} fill={wishlisted ? "#D4AF37" : "none"} />
          </button>

          <button
            onClick={() => setQuickViewOpen(true)}
            className="absolute inset-x-3 bottom-3 flex translate-y-3 items-center justify-center gap-2 bg-alabaster/95 py-3 text-xs uppercase tracking-wide opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Eye size={14} /> Quick View
          </button>
        </div>

        <Link href={`/product/${product.slug}`} className="mt-4 block">
          <p className="text-xs uppercase tracking-widest2 text-obsidian/45">
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
