"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Heart, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { Product } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";
import { ImageGallery } from "./ImageGallery";
import { VariantSelector } from "./VariantSelector";
import { useVariantSelection } from "./useVariantSelection";
import { CompleteTheLook } from "./CompleteTheLook";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useHydrated } from "@/lib/useHydrated";
import { cn, discountPercent, stockLabel } from "@/lib/utils";

interface ProductDetailViewProps {
  product: Product;
  related: Product[];
}

export function ProductDetailView({ product, related }: ProductDetailViewProps) {
  const discount = discountPercent(product.price, product.compareAtPrice);
  const {
    options,
    selections,
    setOption,
    setSelection,
    variant,
    image,
    optionLabels,
    selectionLabels,
    isAvailable,
  } = useVariantSelection(product);
  const addLine = useCartStore((s) => s.addLine);
  // Same as the product card: the server cannot know what is saved, so the
  // first client render must agree with it.
  const hydrated = useHydrated();
  const saved = useWishlistStore((s) => s.has(product.id));
  const wishlisted = hydrated && saved;
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const stock = stockLabel(product.stock);

  return (
    <>
      <div className="container-elevated grid grid-cols-1 gap-14 py-12 lg:grid-cols-2">
        <ImageGallery images={product.images} name={product.name} />

        <div className="lg:max-w-lg">
          <nav className="mb-6 text-xs text-ink-subtle">
            <Link href="/shop" className="inline-block py-1.5 transition-colors hover:text-gold">
              Shop
            </Link>{" "}
            / {product.subCategory}
          </nav>

          <div className="mb-3 flex gap-2">
            {discount !== null && <Badge tone="sale">{discount}% Off</Badge>}
            {product.isNewArrival && <Badge tone="sage">New</Badge>}
            {product.isBestSeller && <Badge tone="gold">Best Seller</Badge>}
          </div>

          <h1 className="font-serif text-4xl font-medium leading-[1.2]">{product.name}</h1>
          <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} size="lg" className="mt-3" />

          <p className="mt-6 text-sm leading-relaxed text-ink-muted">{product.description}</p>

          {product.specs.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-y-2 text-sm">
              {product.specs.map((spec) => (
                <Fragment key={spec.key}>
                  <dt className="text-ink-subtle">{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </Fragment>
              ))}
            </dl>
          )}

          <p
            className={cn(
              "mt-5 text-xs uppercase tracking-wide",
              stock.tone === "out" && "text-ink-subtle",
              stock.tone === "low" && "text-gold-dark",
              stock.tone === "in" && "text-sage-dark"
            )}
          >
            {stock.label}
          </p>

          {product.tags && product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag} tone="sage">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6 border-t border-line pt-6">
            <VariantSelector
              product={product}
              options={options}
              selections={selections}
              onOptionChange={setOption}
              onSelectionChange={setSelection}
            />
          </div>

          <div className="mt-8 flex gap-3">
            <Button
              className="flex-1"
              disabled={!isAvailable}
              onClick={() =>
                addLine({
                  productId: product.id,
                  variantId: variant?.id,
                  slug: product.slug,
                  name: product.name,
                  image,
                  price: product.price,
                  options: optionLabels,
                  selections: selectionLabels,
                })
              }
            >
              {isAvailable ? "Add to Bag" : "Sold Out"}
            </Button>
            <button
              onClick={() => toggleWishlist(product.id)}
              aria-label="Toggle wishlist"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center border border-line-strong hover:border-ink"
            >
              <Heart size={18} fill={wishlisted ? "#CDAD54" : "none"} />
            </button>
          </div>

          <div className="mt-8 space-y-3 border-t border-line pt-6 text-sm text-ink-muted">
            <p className="flex items-center gap-2">
              <Truck size={15} /> Complimentary shipping within Ghana on orders over GH₵1,000
            </p>
            <p className="flex items-center gap-2">
              <RefreshCw size={15} /> 30-day returns &amp; exchanges
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck size={15} /> 2-year craftsmanship guarantee
            </p>
          </div>
        </div>
      </div>

      <CompleteTheLook products={related} />
    </>
  );
}
